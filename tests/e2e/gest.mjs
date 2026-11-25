const [SP, ROOT] = process.argv.slice(2); const B = 'file://' + ROOT + '/public/index.html';
let list; for (let i=0;i<40;i++){ try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r=>setTimeout(r,250)); } }
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); const errs=[];
const cmd=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.onmessage=m=>{const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id);} if(d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
const out=[]; const ok=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
const st=()=>ev('JSON.parse(localStorage.getItem("gyf:v1"))');
const center=()=>ev('(()=>{const b=document.querySelector(".scard.top").getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/3)}})()');
await cmd('Page.enable'); await cmd('Runtime.enable');
await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
await cmd('Page.navigate',{url:B}); await sleep(500);
await ev(`localStorage.setItem("gyf:v1", JSON.stringify({saved:{},colleges:[],p:{},filters:{},quiz:{v:3,done:true,step:0,answers:{}}})); location.hash="#/swipe"; location.reload(); true`); await sleep(800);
// 1) trackpad two-finger swipe RIGHT followed by ~0.6s of momentum (natural scrolling => negative deltaX)
let c = await center(); let id1 = await ev('document.querySelector(".scard.top").dataset.id');
for (let i=0;i<8;i++){ await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:c.x,y:c.y,deltaX:-25,deltaY:0}); await sleep(16); }
for (let i=0;i<36;i++){ await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:c.x,y:c.y,deltaX:-Math.max(1,25-i*0.7),deltaY:0}); await sleep(16); }
await sleep(500);
const after = await st();
let id2 = await ev('document.querySelector(".scard.top").dataset.id');
ok('trackpad swipe right saves exactly one card (momentum ignored)', after.saved[id1]===true && Object.keys(after.saved).length===1 && id2!==id1);
// trackpad swipe LEFT
for (let i=0;i<8;i++){ await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:c.x,y:c.y,deltaX:25,deltaY:0}); await sleep(16); }
await sleep(600);
ok('trackpad swipe left passes', (await st()).passed[id2]===true);
// small nudge springs back
let id3 = await ev('document.querySelector(".scard.top").dataset.id'); await sleep(700);
for (let i=0;i<3;i++){ await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:c.x,y:c.y,deltaX:-20,deltaY:0}); await sleep(16); }
await sleep(500);
ok('small nudge springs back (no decision)', await ev('document.querySelector(".scard.top").dataset.id')===id3 && !(await st()).saved[id3] && (await ev('document.querySelector(".scard.top").style.transform'))==='');
// vertical scroll does not swipe
for (let i=0;i<6;i++){ await cmd('Input.dispatchMouseEvent',{type:'mouseWheel',x:c.x,y:c.y,deltaX:0,deltaY:40}); await sleep(16); }
await sleep(300);
ok('vertical scroll does not swipe', await ev('document.querySelector(".scard.top").dataset.id')===id3);
// 2) phone touch swipe right
await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
await cmd('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1}); await sleep(300);
c = await center(); const id4 = await ev('document.querySelector(".scard.top").dataset.id');
await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c.x,y:c.y}]});
for (let i=1;i<=10;i++){ await cmd('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x+i*16,y:c.y+i}]}); await sleep(16); }
await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await sleep(500);
ok('phone finger swipe right saves', (await st()).saved[id4]===true);
// 3) mouse drag left
await cmd('Emulation.setTouchEmulationEnabled',{enabled:false});
await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false}); await sleep(300);
c = await center(); const id5 = await ev('document.querySelector(".scard.top").dataset.id');
await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:c.x,y:c.y,button:'left',clickCount:1});
for (let i=1;i<=10;i++){ await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:c.x-i*18,y:c.y,button:'left',buttons:1}); await sleep(15); }
await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:c.x-180,y:c.y,button:'left',clickCount:1}); await sleep(500);
ok('mouse drag left passes', (await st()).passed[id5]===true);
ok('no JS errors', errs.length===0); if (errs.length) console.log(errs);
console.log(out.join('\n')); process.exit(0);
