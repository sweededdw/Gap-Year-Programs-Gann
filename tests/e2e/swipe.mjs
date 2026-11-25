import { writeFileSync } from 'node:fs';
const [SP, ROOT] = process.argv.slice(2); const B = 'file://' + ROOT + '/public/index.html';
let list; for (let i=0;i<40;i++){ try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r=>setTimeout(r,250)); } }
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map();
const cmd=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.onmessage=m=>{const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id);} if(d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);};
const errs=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
const vp=async(w,h,mobile=false)=>cmd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile});
const shot=async n=>{const r=await cmd('Page.captureScreenshot',{format:'png'}); writeFileSync(`${SP}/${n}.png`,Buffer.from(r.result.data,'base64'));};
const click=async sel=>{ await ev(`document.querySelector(${JSON.stringify(sel)}).click(); true`); await sleep(350); };
const out=[]; const ok=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
await cmd('Page.enable'); await cmd('Runtime.enable'); await vp(1280,900);
await cmd('Page.navigate',{url:B}); await sleep(600); await ev('localStorage.clear(); location.hash="#/start"; location.reload(); true'); await sleep(800);
ok('first visit shows quiz intro', /Find your year in Israel/.test(await ev('document.querySelector("h1").textContent')));
await ev(`localStorage.setItem("gyf:v1", JSON.stringify({saved:{},colleges:[],p:{},filters:{},quiz:{v:3,done:true,step:0,answers:{deal:{orientation:["pluralistic","conservative"]},prefs:{peers:{want:5,weight:3}},field:["tech"],city:["jerusalem"]}}})); location.hash="#/swipe"; location.reload(); true`); await sleep(900);
const n = await ev('document.querySelector(".swipe-head p").textContent.match(/of (\\d+)/)[1]');
ok('finish -> swipe deck', await ev('location.hash')==='#/swipe' && !!(await ev('!!document.querySelector(".scard.top")')));
ok(`deck shows "1 of ${n}"`, (await ev('document.querySelector(".swipe-head p").textContent')).startsWith('1 of '+n));
ok('match % shown', /% match/.test(await ev('document.querySelector(".scard.top .scard-match")?.textContent||""')));
ok('card lists matched reasons', (await ev('document.querySelectorAll(".scard.top .chips .chip").length')) > 0);
const first = await ev('document.querySelector(".scard.top").dataset.id');
await click('[data-act=swipe-like]'); await sleep(200);
ok('♥ saves the card', await ev(`JSON.parse(localStorage.getItem("gyf:v1")).saved["${first}"]===true`) && await ev('document.getElementById("saved-count").textContent')==='1');
const second = await ev('document.querySelector(".scard.top").dataset.id');
await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37}); await sleep(450);
ok('← key passes', await ev(`JSON.parse(localStorage.getItem("gyf:v1")).passed["${second}"]===true`));
await click('[data-act=swipe-undo]'); await sleep(200);
ok('undo brings card back', await ev('document.querySelector(".scard.top").dataset.id')===second);
// real mouse drag to the right
const r = await ev('(()=>{const b=document.querySelector(".scard.top").getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()');
await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',clickCount:1});
for (let i=1;i<=10;i++){ await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+i*18,y:r.y+i*2,button:'left',buttons:1}); await sleep(15); }
ok('stamp fades in while dragging', +(await ev('getComputedStyle(document.querySelector(".scard.top .stamp.like")).opacity')) > 0.8);
await shot('d-drag');
await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+180,y:r.y+20,button:'left',clickCount:1}); await sleep(500);
ok('drag right saves', await ev(`JSON.parse(localStorage.getItem("gyf:v1")).saved["${second}"]===true`));
// tap opens details, back link returns to swiping
const third = await ev('document.querySelector(".scard.top").dataset.id');
const r2 = await ev('(()=>{const b=document.querySelector(".scard.top").getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()');
await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:r2.x,y:r2.y,button:'left',clickCount:1});
await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:r2.x,y:r2.y,button:'left',clickCount:1}); await sleep(400);
ok('tap opens program page', await ev('location.hash')==='#/program/'+third);
ok('detail has official website button + Website fact', !!(await ev('!!document.querySelector(".school-head a[target=_blank]")')) && /Website/.test(await ev('document.querySelector("#sec-overview").textContent')));
ok('back link says "Back to swiping"', /Back to swiping/.test(await ev('document.querySelector(".back").textContent')));
await click('.back'); await sleep(200);
ok('back returns to same card', await ev('document.querySelector(".scard.top")?.dataset.id')===third);
// swipe through the rest
for (let i=0;i<40 && await ev('!!document.querySelector("[data-act=swipe-pass]")');i++){ await click('[data-act=swipe-pass]'); await sleep(150); }
ok('end screen after last card', /seen all your matches/.test(await ev('document.querySelector("h1").textContent')));
await shot('d-end');
await click('[data-act=swipe-reset]'); await sleep(200);
ok('"review passed" refills deck', !!(await ev('!!document.querySelector(".scard.top")')));
await click('[data-act=retake]'); await sleep(200);
ok('retake -> dealbreakers, answers kept', await ev('document.querySelectorAll(".qchip.on:not(.any)").length')===2);
await click('[data-nav=finder]'); await sleep(300);
ok('Browse all lists 38', await ev('document.querySelectorAll(".bcard").length')===38);
ok('no JS errors', errs.length===0); if (errs.length) console.log(errs);
console.log(out.join('\n')); ws.close(); process.exit(0);
