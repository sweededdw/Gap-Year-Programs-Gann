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
await cmd('Page.enable'); await cmd('Runtime.enable');
const res=[];
for (const w of [1440, 1100, 820, 701, 390]) {
  await vp(w, 1100); await cmd('Page.navigate',{url:B}); await sleep(400);
  await ev(`localStorage.setItem("gyf:v1", JSON.stringify({quiz:{v:3,done:false,step:2,answers:{deal:{},prefs:{},field:[],city:[]}}})); location.hash="#/start"; location.reload(); true`); await sleep(900);
  const o = await ev(`[...document.querySelectorAll(".prow")].map(r=>{const five=r.querySelector('.pnum[data-value="5"]').getBoundingClientRect(), one=r.querySelector('.pnum[data-value="1"]').getBoundingClientRect(), ends=r.querySelectorAll(".pend"), L=ends[0].getBoundingClientRect(), R=ends[1].getBoundingClientRect(), dc=r.querySelector(".popt.dc").getBoundingClientRect(); const ov=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top); return ov(five,R)||ov(one,L)||ov(R,dc)||ov(five,dc)}).filter(Boolean).length`);
  res.push((o===0?"PASS ":"FAIL ")+"quiz scale labels don't overlap at "+w+"px ("+o+" overlaps)");
  if (w===1440 || w===390 || w===820) await shot('prow-'+w);
}
res.push((errs.length?"FAIL ":"PASS ")+"no JS errors"); console.log(res.join("\n")); process.exit(0);
