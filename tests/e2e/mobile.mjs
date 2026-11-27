// Phone layouts: the swipe deck and Compare at common iPhone sizes (screen minus browser bars).
import { writeFileSync } from 'node:fs';
const [SP, ROOT] = process.argv.slice(2); const B = 'file://' + ROOT + '/public/index.html';
let list; for (let i=0;i<40;i++){ try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r=>setTimeout(r,250)); } }
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); const errs=[];
const cmd=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.onmessage=m=>{const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){pend.get(d.id)(d);pend.delete(d.id);} if(d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
const vp=(w,h)=>cmd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true});
const shot=async (n,full)=>{const r=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:!!full}); writeFileSync(`${SP}/${n}.png`,Buffer.from(r.result.data,'base64'));};
const out=[]; const ok=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
await cmd('Page.enable'); await cmd('Runtime.enable');
const STATE = JSON.stringify({saved:{},colleges:[],p:{},filters:{},quiz:{v:3,done:true,step:0,answers:{deal:{},prefs:{peers:{want:5,weight:3}},field:[],city:[]}}});
await cmd('Page.navigate',{url:B}); await sleep(600);
// iPhone SE (375x667 screen, ~548 visible in Safari), iPhone 14 (390x844, ~664 visible), Pro Max (430x932, ~740 visible)
for (const [w,h,name] of [[375,548,'se'],[390,664,'14'],[430,740,'max']]) {
  await vp(w,h);
  await ev(`localStorage.clear(); localStorage.setItem("gyf:v1", ${JSON.stringify(STATE)}); location.hash="#/swipe"; location.reload(); true`); await sleep(1000);
  await ev('scrollTo(0,0); true'); await sleep(150);
  const m = await ev(`(()=>{const c=document.querySelector(".scard.top").getBoundingClientRect(); const bar=document.querySelector(".topbar").getBoundingClientRect(); const btn=document.querySelector(".swipe-btns, .sbtns, .sbtn")?.getBoundingClientRect(); const hero=document.querySelector(".scard.top .scard-hero").getBoundingClientRect();
    return {cardTop:c.top, cardBottom:c.bottom, barBottom:bar.bottom, btnBottom:btn?btn.bottom:null, heroTop:hero.top, vh:innerHeight, sw:document.documentElement.scrollWidth, iw:innerWidth};})()`);
  ok(`swipe ${name} (${w}x${h}): card top is below the top bar (${JSON.stringify(m)})`, m.cardTop >= m.barBottom - 1 && m.heroTop >= m.barBottom - 1);
  ok(`swipe ${name}: whole card and buttons fit on screen without scrolling`, m.cardBottom <= m.vh + 1 && (m.btnBottom===null || m.btnBottom <= m.vh + 1));
  ok(`swipe ${name}: no sideways scroll`, m.sw <= m.iw);
  ok(`swipe ${name}: card shows its links (nothing cut off at the bottom)`, await ev(`(()=>{const c=document.querySelector('.scard.top').getBoundingClientRect(); const l=document.querySelector('.scard.top .scard-links').getBoundingClientRect(); return l.bottom <= c.bottom + 1 && l.height > 20;})()`));
  const nav = await ev(`(()=>{const b=document.querySelector(".nav-toggle"); const vis=[...document.querySelectorAll(".topnav a")].filter(a=>a.offsetParent).length; b.click(); const open=[...document.querySelectorAll(".topnav a")].filter(a=>a.offsetParent).length; const exp=b.getAttribute("aria-expanded"); b.click(); return {vis, open, exp, barH: document.querySelector(".topbar").getBoundingClientRect().height};})()`);
  ok(`phone ${name}: top bar is one slim row with links behind Menu (${JSON.stringify(nav)})`, nav.vis===0 && nav.open===6 && nav.exp==='true' && nav.barH <= 62);
  const full = await ev(`(()=>{const b=document.querySelector(".nav-toggle"); b.click(); const r=document.querySelector(".topbar").getBoundingClientRect(); const home=document.querySelector("[data-nav=home]"); home.click(); const subs=[...document.querySelectorAll("#nav-sub-home a")].filter(a=>a.offsetParent).map(a=>a.textContent).join(","); const exp=home.getAttribute("aria-expanded"); const hash=location.hash; b.click(); return {h:r.height, vh:innerHeight, subs, exp, hash, closed:!document.querySelector(".topbar").classList.contains("nav-open")};})()`);
  ok(`phone ${name}: Menu opens the bar full screen, and Home expands to Overview and Map in place (${JSON.stringify(full)})`, full.h >= full.vh - 1 && full.subs==='Overview,Map' && full.exp==='true' && full.hash==='#/swipe' && full.closed);
  await ev('scrollTo(0,0); true'); await sleep(100);
  await shot('m-swipe-'+name);

  await ev(`location.hash="#/compare/aardvark,year-course,torah-tech"; true`); await sleep(700); await ev('scrollTo(0,0); true'); await sleep(150);
  const c = await ev(`(()=>{const t=document.querySelector(".cmp-m, table.cmp"); return {sw:document.documentElement.scrollWidth, iw:innerWidth, names:[...document.querySelectorAll(".cmp-name")].map(n=>{const r=n.getBoundingClientRect(); return [n.textContent, Math.round(r.left), Math.round(r.right)];})};})()`);
  ok(`compare ${name}: no sideways page scroll`, c.sw <= c.iw);
  ok(`compare ${name}: all three program names visible on screen without sideways scrolling (${JSON.stringify(c.names)})`, c.names.length===3 && c.names.every(n=>n[1]>=0 && n[2]<=w+1));
  const tw = await ev(`(()=>{const t=document.querySelector('table.cmp'); return [t.scrollWidth, t.clientWidth];})()`);
  ok(`compare ${name}: table fits the screen width (${tw})`, tw[0] <= tw[1] + 1);
  ok(`compare ${name}: names bar hidden at the top`, !(await ev(`document.querySelector('.cmp-pin').classList.contains('show')`)));
  await ev('scrollTo(0, 900); true'); await sleep(400);
  ok(`compare ${name}: names bar pinned under the top bar after scrolling`, await ev(`(()=>{const p=document.querySelector('.cmp-pin'); const b=document.querySelector('.topbar').getBoundingClientRect(); return p.classList.contains('show') && Math.abs(p.getBoundingClientRect().top - b.bottom) < 3 && p.textContent.includes('Torah Tech');})()`));
  await shot('m-compare-scrolled-'+name);
  await ev('scrollTo(0,0); true'); await sleep(200);
  await shot('m-compare-'+name, true);
}
await vp(390,844); await ev('location.hash="#/program/year-course"; true'); await sleep(800); await ev('scrollTo(0,0); true');
ok('program page on a phone: key features fit, no sideways scroll', await ev('document.documentElement.scrollWidth<=innerWidth') && !!(await ev('!!document.querySelector("#key-features .kf-tile")')));
{ const r=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); writeFileSync(`${SP}/m-program.png`,Buffer.from(r.result.data,'base64')); }
ok('no JS errors', errs.length===0); if(errs.length) console.log(errs);
console.log(out.join('\n')); process.exit(0);
