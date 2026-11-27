import { writeFileSync } from 'node:fs';
const [SP, ROOT] = process.argv.slice(2); const B = 'file://' + ROOT + '/public/index.html';
let list; for (let i=0;i<40;i++){ try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r=>setTimeout(r,250)); } }
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); const errs=[];
const cmd=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.onmessage=m=>{const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id);} if(d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
const vp=(w,h)=>cmd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<500});
const shot=async n=>{const r=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); writeFileSync(`${SP}/${n}.png`,Buffer.from(r.result.data,'base64'));};
const click=async sel=>{ await ev(`document.querySelector(${JSON.stringify(sel)}).click(); true`); await sleep(150); };
const out=[]; const ok=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
await cmd('Page.enable'); await cmd('Runtime.enable'); await vp(1280,1300);
await cmd('Page.navigate',{url:B}); await sleep(400);
await ev(`localStorage.setItem("gyf:v1", JSON.stringify({quiz:{v:3,done:false,step:1,answers:{deal:{},prefs:{},field:[],city:[]}}})); location.hash="#/start"; location.reload(); true`); await sleep(900);
await ev('document.querySelector(".qchip.any[data-key=orientation]").click(); true'); await sleep(350);
const anyBg = await ev('getComputedStyle(document.querySelector(".qchip.any[data-key=orientation]")).borderColor');
const optBg = await ev('(()=>{document.querySelector("[data-key=budget]"); const b=document.querySelector(".qchip[data-key=gender][data-value=coed]"); b.click(); return true})()'); await sleep(200);
await sleep(350); // let the segment highlight finish sliding
// Single choices are a segmented control: the selected border is drawn by its sliding highlight.
const onBorder = await ev('(()=>{const c=document.querySelector(".qchip.on[data-key=gender]"), p=c.closest(".qseg") && c.closest(".qseg").querySelector(".seg-pill"); return getComputedStyle(p || c).borderTopColor})()');
ok(`selected "Any" uses the same blue border as other choices (${anyBg} vs ${onBorder})`, anyBg===onBorder);
await shot('dc-step1');
await ev('document.querySelector("[data-act=quiz-next]").click(); true'); await sleep(400);
await ev('document.querySelector(".popt.dc[data-key=academics]").click(); true'); await sleep(200);
await ev('document.querySelector(".pnum[data-key=social][data-value=\\"3\\"]").click(); true'); await sleep(400);
const r = await ev(`(()=>{const a=document.querySelector(".popt.dc[data-key=academics]").closest(".prow"), b=document.querySelector(".pnum[data-key=social]").closest(".prow"); return {aAct:a.classList.contains("active"), bAct:b.classList.contains("active"), aB:getComputedStyle(a).borderColor, bB:getComputedStyle(b).borderColor, dcBg:getComputedStyle(document.querySelector(".popt.dc.on")).backgroundColor, numBg:getComputedStyle(document.querySelector(".pnum.on")).backgroundColor}})()`);
ok(`"Don't care" turns the whole row blue like a number does (${r.aB} / ${r.bB})`, r.aAct && r.bAct && r.aB===r.bB);
ok(`selected "Don't care" button is filled blue like a selected number (${r.dcBg} / ${r.numBg})`, r.dcBg===r.numBg);
ok('unanswered rows stay plain', await ev('document.querySelectorAll(".prow.active").length')===2);
await shot('dc-step2');
ok('no JS errors', errs.length===0);
console.log(out.join('\n')); process.exit(0);
