// Motion touches (public/js/motion.js): nav pill, heart pop, rolling Saved count, quick search palette.
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
const shot=async n=>{const r=await cmd('Page.captureScreenshot',{format:'png'}); writeFileSync(`${SP}/${n}.png`,Buffer.from(r.result.data,'base64'));};
const key=async (k, mods=0, text)=>{ const code = k.length===1 ? 'Key'+k.toUpperCase() : k; await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,modifiers:mods,text, windowsVirtualKeyCode: k==='Enter'?13:k==='Escape'?27:k==='ArrowDown'?40:k.toUpperCase().charCodeAt(0)}); await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,modifiers:mods}); };
const out=[]; const ok=(n,c)=>{out.push((c?'PASS ':'FAIL ')+n); if(process.env.TRACE) console.error((c?'PASS ':'FAIL ')+n);};
await cmd('Page.enable'); await cmd('Runtime.enable'); await vp(1280,900);
await cmd('Page.navigate',{url:B}); await sleep(500);
await ev(`localStorage.clear(); localStorage.setItem("gyf:v1", JSON.stringify({quiz:{v:3,step:0,done:true,answers:{}}})); location.hash="#/browse"; location.reload(); true`); await sleep(1300);

// 1. Nav pill sits behind the active link and follows it.
const pillAt = `(()=>{const p=document.querySelector(".topnav .nav-pill"), a=document.querySelector(".topnav a.active"); if(!p||!a) return null; const pr=p.getBoundingClientRect(), ar=a.getBoundingClientRect(); return {dx:Math.abs(pr.left-ar.left), dw:Math.abs(pr.width-ar.width), op:getComputedStyle(p).opacity, bg:getComputedStyle(a).backgroundColor, nav:a.dataset.nav}})()`;
let p1 = await ev(pillAt);
ok('nav pill under the active link '+JSON.stringify(p1), p1 && p1.dx<2 && p1.dw<2 && p1.op==='1' && p1.nav==='finder');
ok('active link drops its own background when the pill is there', p1 && /rgba\(0, 0, 0, 0\)|transparent/.test(p1.bg));
await ev(`location.hash="#/colleges"; true`); await sleep(700);
let p2 = await ev(pillAt);
ok('pill moves to the new page '+JSON.stringify(p2), p2 && p2.dx<2 && p2.dw<2 && p2.nav==='colleges');
await ev(`location.hash="#/browse"; true`); await sleep(700);

// 2 + 3. Saving pops the heart, adds a burst and rolls the Saved count.
const before = await ev(`+document.getElementById("saved-count").textContent`);
await ev(`document.querySelector('.heart[data-act="save"]').click(); true`); await sleep(60);
const h = await ev(`(()=>{const b=document.querySelector('.heart[data-act="save"]'); return {pressed:b.getAttribute("aria-pressed"), pop:!!b.querySelector("svg.pop"), burst:document.querySelectorAll(".heart-burst i").length, roll:!!document.querySelector("#saved-count .roll-up"), count:+document.getElementById("saved-count").textContent}})()`);
ok('heart pops when saved '+JSON.stringify(h), h.pressed==='true' && h.pop && h.burst===8);
ok('Saved count rolls up', h.roll && h.count===before+1);
await sleep(800);
ok('burst cleans itself up', await ev(`document.querySelectorAll(".heart-burst").length===0`));
await ev(`document.querySelector('.heart[data-act="save"]').click(); true`); await sleep(60);
ok('unsaving rolls the count down, no burst', await ev(`!!document.querySelector("#saved-count .roll-down") && +document.getElementById("saved-count").textContent===${before} && !document.querySelector(".heart-burst")`));

// 4. Quick search.
ok('search button in the top bar', await ev(`!!document.querySelector(".topbar-tools .qs-open")`));
await key('k', 2 /* ctrl */); await sleep(350);
ok('Ctrl+K opens the palette with focus in the field', await ev(`(()=>{const q=document.querySelector(".qs"); return q && !q.hidden && q.classList.contains("on") && document.activeElement===q.querySelector(".qs-input")})()`));
ok('empty query lists pages and programs', await ev(`document.querySelectorAll(".qs-sec").length===2 && document.querySelectorAll(".qs-row").length>=10`));
await ev(`(()=>{const i=document.querySelector(".qs-input"); i.value="year course"; i.dispatchEvent(new Event("input")); return true})()`); await sleep(100);
const top = await ev(`document.querySelector('.qs-row[aria-selected="true"] .qs-t').textContent`);
ok('typing ranks the match first ('+top+')', /Year Course/.test(top));
await shot('motion-search');
await key('Enter'); await sleep(500);
ok('Enter opens the program and closes the palette', await ev(`location.hash.indexOf("#/program/")===0 && document.querySelector(".qs").hidden && document.querySelector(".qs-input")!==document.activeElement`));
await ev(`document.activeElement && document.activeElement.blur(); true`);
await key('/', 0, '/'); await sleep(300);
ok('"/" opens it too', await ev(`!document.querySelector(".qs").hidden`));
await ev(`(()=>{const i=document.querySelector(".qs-input"); i.value="zzzzqqq"; i.dispatchEvent(new Event("input")); return true})()`); await sleep(50);
ok('no-match message', await ev(`!!document.querySelector(".qs-empty")`));
await key('Escape'); await sleep(300);
ok('Escape closes it', await ev(`document.querySelector(".qs").hidden && !document.documentElement.classList.contains("qs-lock")`));
await ev(`location.hash="#/browse"; true`); await sleep(600);
await ev(`(()=>{const s=document.querySelector('[data-act="search"]'); if(s){s.focus();} return true})()`);
await key('/', 0, '/'); await sleep(200);
ok('"/" while typing in a field does not open the palette', await ev(`document.querySelector(".qs").hidden`));

// The route: checklist stops with a finish flag, a flag after the quiz steps, and the sources line.
await ev(`location.hash="#/program/aardvark"; true`); await sleep(600);
const rt = await ev(`(()=>{const a=[...document.querySelectorAll(".toc.route a.rt")]; return {n:a.length, endFlag:!!(a[a.length-1]&&a[a.length-1].classList.contains("rt-end")&&a[a.length-1].querySelector("svg")), src:(document.querySelector(".src-line")||{}).textContent||"", srcTarget:!!document.getElementById("sources")}})()`);
ok('checklist is a route of 11 stops ending in a flag '+JSON.stringify(rt), rt.n===11 && rt.endFlag);
ok('header says where the facts come from', /Facts from \d+ sources?, checked /.test(rt.src) && rt.srcTarget);
await ev(`(()=>{const s=JSON.parse(localStorage.getItem("gyf:v1")); s.quiz={v:3,step:1,done:false,answers:{}}; localStorage.setItem("gyf:v1",JSON.stringify(s)); location.hash="#/start"; location.reload(); return true})()`); await sleep(1300);
ok('quiz steps run to a finish flag', await ev(`document.querySelectorAll(".quiz-dots span").length===2 && !!document.querySelector(".quiz-top .route-end svg")`));
const cr = await ev(`(()=>{document.documentElement.setAttribute("data-theme","daylight"); const cs=getComputedStyle(document.documentElement); const L=h=>{h=h.trim(); const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)); return .2126*c[0]+.7152*c[1]+.0722*c[2]}; const R=(a,b)=>{const x=L(cs.getPropertyValue(a)),y=L(cs.getPropertyValue(b)); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}; const r={accent:R("--accent","--accent-soft"), ok:R("--ok","--ok-soft")}; document.documentElement.setAttribute("data-theme","sunset"); return r})()`);
ok('Daylight accent and ok text reach 4.5:1 on their soft backgrounds '+JSON.stringify(cr), cr.accent>=4.5 && cr.ok>=4.5);
await ev(`(()=>{const s=JSON.parse(localStorage.getItem("gyf:v1")); s.quiz={v:3,step:0,done:true,answers:{}}; localStorage.setItem("gyf:v1",JSON.stringify(s)); location.hash="#/browse"; location.reload(); return true})()`); await sleep(1300);

// Desktop screenshot, then phone: pill off (menu is a grid), search button fits, no sideways scroll.
await ev(`document.activeElement && document.activeElement.blur(); true`);
await shot('motion-desktop');
await vp(390,850); await sleep(400);
ok('pill hidden on phones', await ev(`(()=>{const p=document.querySelector(".nav-pill"); return !p || getComputedStyle(p).opacity==="0"})()`));
ok('phone top bar has no sideways scroll', await ev(`document.documentElement.scrollWidth<=390`));
ok('search button is icon-only on phones', await ev(`getComputedStyle(document.querySelector(".qs-open-label")).display==="none"`));
await ev(`document.querySelector(".nav-toggle").click(); true`); await sleep(200);
ok('phone menu active tile keeps its own highlight', await ev(`!/rgba\\(0, 0, 0, 0\\)/.test(getComputedStyle(document.querySelector(".topnav a.active")).backgroundColor)`));
await shot('motion-mobile');
ok('no JS errors', errs.length===0);
console.log(out.join('\n')); process.exit(0);
