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
ok('quiz asks which communities you feel comfortable with', await ev(`[...document.querySelectorAll("#app h3")].some(h=>h.textContent.trim()==="Which communities do you feel comfortable with?")`));
ok('quiz steps run to a finish flag', await ev(`document.querySelectorAll(".quiz-dots span").length===2 && !!document.querySelector(".quiz-top .route-end svg")`));
const cr = await ev(`(()=>{document.documentElement.setAttribute("data-theme","daylight"); const cs=getComputedStyle(document.documentElement); const L=h=>{h=h.trim(); const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)); return .2126*c[0]+.7152*c[1]+.0722*c[2]}; const R=(a,b)=>{const x=L(cs.getPropertyValue(a)),y=L(cs.getPropertyValue(b)); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}; const r={accent:R("--accent","--accent-soft"), ok:R("--ok","--ok-soft")}; document.documentElement.setAttribute("data-theme","sunset"); return r})()`);
ok('Daylight accent and ok text reach 4.5:1 on their soft backgrounds '+JSON.stringify(cr), cr.accent>=4.5 && cr.ok>=4.5);
await ev(`(()=>{const s=JSON.parse(localStorage.getItem("gyf:v1")); s.quiz={v:3,step:0,done:true,answers:{}}; localStorage.setItem("gyf:v1",JSON.stringify(s)); location.hash="#/browse"; location.reload(); return true})()`); await sleep(1300);

// Undo instead of "Are you sure?", copy-link buttons, page titles, the empty Saved list.
await ev(`(()=>{const s=JSON.parse(localStorage.getItem("gyf:v1")); s.colleges=[{name:"Brandeis University",policy:"",deadline:"",status:"",app:"",plan:"",appDeadline:"",notes:""}]; s.saved={}; localStorage.setItem("gyf:v1",JSON.stringify(s)); location.hash="#/results"; location.reload(); return true})()`); await sleep(1300);
ok('page title names the page', await ev(`document.title`)==='Your top 3 · Israel Gap Year Finder');
await ev(`document.querySelector(".results [data-act=restart]").click(); true`); await sleep(500);
ok('restarting the quiz asks nothing and offers Undo', await ev(`location.hash==="#/start" && !!document.querySelector(".undo-toast .ut-undo") && JSON.parse(localStorage.getItem("gyf:v1")).quiz.done===false`));
await ev(`document.querySelector(".undo-toast .ut-undo").click(); true`); await sleep(500);
ok('Undo brings the answers and the top 3 back', await ev(`location.hash==="#/results" && JSON.parse(localStorage.getItem("gyf:v1")).quiz.done===true && !document.querySelector(".undo-toast")`));
await ev(`location.hash="#/colleges"; true`); await sleep(600);
await ev(`(()=>{document.querySelectorAll("#app details").forEach(d=>d.open=true); const b=document.querySelector('[data-act="del-college"]'); if(b) b.click(); return !!b})()`); await sleep(300);
ok('removing a college happens at once, with Undo', await ev(`JSON.parse(localStorage.getItem("gyf:v1")).colleges.length===0 && /Removed Brandeis University/.test((document.querySelector(".undo-toast .ut-text")||{}).textContent||"")`));
await ev(`document.querySelector(".undo-toast .ut-undo").click(); true`); await sleep(300);
ok('Undo puts the college back', await ev(`JSON.parse(localStorage.getItem("gyf:v1")).colleges[0].name==="Brandeis University"`));
await ev(`location.hash="#/program/aardvark"; true`); await sleep(600);
ok('program page title is the program name', /^Aardvark Israel · /.test(await ev(`document.title`)));
await ev(`document.execCommand = () => true; document.querySelector('.actions .copy-btn[data-act="share"]').click(); true`); await sleep(250);
ok('Share copies the link and says so on the button', await ev(`(()=>{const b=document.querySelector(".actions .copy-btn"); return b.classList.contains("copied") && b.dataset.hash==="#/program/aardvark" && b.querySelector(".cp-live").textContent==="Link copied"})()`));
await ev(`location.hash="#/my-list"; true`); await sleep(500);
ok('empty Saved list points to Browse', await ev(`!!document.querySelector('.card.empty a[href="#/browse"]')`));
await ev(`location.hash="#/browse"; true`); await sleep(600);

// Craft pass: nothing fades in on scroll or types itself, buttons carry no forward arrows, quotes are typographer's quotes.
await ev(`location.hash="#/start"; true`); await sleep(500);
ok('quiz headline is plain text, shown at once', await ev(`(()=>{const h=document.querySelector(".quiz-intro h1"); return h.textContent==="Find your year in Israel" && !h.children.length && getComputedStyle(h).textWrap.indexOf("balance")===0})()`));
ok('Start button says what it does, with no arrow', await ev(`document.querySelector(".quiz-intro [data-act=quiz-next]").textContent`)==='Start the quiz');
await ev(`document.querySelector(".quiz-intro [data-act=quiz-next]").click(); true`); await sleep(400);
ok('quiz text uses curly quotes and apostrophes', await ev(`(()=>{const t=document.querySelector(".quiz").textContent; return /haven\u2019t posted/.test(t) && /Women\u2019s/.test(t) && !/["']/.test(t)})()`));
await ev(`location.hash="#/results"; true`); await sleep(600);
ok('results page has no notation legend', await ev(`!/In a breakdown/.test(document.querySelector("#app").textContent)`));
ok('no forward arrows on the results buttons', await ev(`[...document.querySelectorAll(".results .btn")].every(b=>!/\u2192/.test(b.textContent))`));
await ev(`location.hash="#/browse"; true`); await sleep(700);
const rv = await ev(`(()=>{const c=[...document.querySelectorAll(".bcard")]; const l=c[c.length-1]; return {n:c.length, hidden:c.filter(x=>getComputedStyle(x).opacity!=="1").length, cls:l.className}})()`);
ok('every card is visible from the start, on screen or below the fold '+JSON.stringify(rv), rv.n>0 && rv.hidden===0 && !/\brv\b/.test(rv.cls));
const pr = await ev(`(()=>{const b=document.querySelector(".bcard-actions .btn"); const cs=getComputedStyle(b); const d=document.createElement("button"); d.className="btn primary"; document.body.appendChild(d); const img=getComputedStyle(d).backgroundImage; d.remove(); return {dur:cs.transitionDuration, prop:cs.transitionProperty, img}})()`);
ok('buttons animate only their press, in 150ms, with no shimmer layer '+JSON.stringify(pr), /scale|transform/.test(pr.prop) && /0\.15s/.test(pr.dur) && pr.img==="none");
await ev(`location.hash="#/program/aardvark"; true`); await sleep(700);
ok('program header: type label sits in the tag row, under the name', await ev(`(()=>{const h=document.querySelector(".school-head"); const b=h.querySelector(".chips .type-badge"); return !!b && (h.querySelector("h1").compareDocumentPosition(b) & 4)===4})()`));
ok('key features are plain facts, not boxed tiles', await ev(`(()=>{const t=document.querySelector("#key-features .kf-tile"); const cs=getComputedStyle(t); return !document.querySelector("#key-features .kf-ic") && cs.borderTopWidth==="0px" && cs.textTransform==="none" && getComputedStyle(t.querySelector(".kf-label")).textTransform==="none"})()`));
await ev(`(()=>{const s=JSON.parse(localStorage.getItem("gyf:v1")); s.collegeQuery="emory"; localStorage.setItem("gyf:v1",JSON.stringify(s)); location.hash="#/colleges"; location.reload(); return true})()`); await sleep(1300);
const cc = await ev(`(()=>{const c=document.querySelector(".card.college"); const d=c.querySelector("details.college-more"); const shut={open:d.open, factsShown:c.querySelector(".college-facts").checkVisibility(), chips:c.querySelectorAll(".college-head .pbadge").length, by:(c.querySelector(".college-by")||{}).textContent||""}; d.querySelector("summary").click(); return {shut, open:d.open, quote:!!d.querySelector(".college-quote"), source:!!d.querySelector('a[target=_blank]')}})()`);
ok('college card shows the answer first; the full policy opens on a click '+JSON.stringify(cc), cc.shut.open===false && cc.shut.factsShown===false && cc.shut.chips>=2 && /^Ask by /.test(cc.shut.by) && cc.open===true && cc.source);
await ev(`(()=>{const s=JSON.parse(localStorage.getItem("gyf:v1")); s.collegeQuery=""; localStorage.setItem("gyf:v1",JSON.stringify(s)); location.hash="#/browse"; location.reload(); return true})()`); await sleep(1300);

// Saved is a sub-tab of Discover.
ok('no Saved tab in the top menu; the count rides on Discover', await ev(`!document.querySelector('.topnav [data-nav="my-list"]') && !!document.querySelector('.topnav [data-nav="discover"] #saved-count')`));
await ev(`location.hash="#/swipe"; true`); await sleep(600);
const tabsTxt = await ev(`[...document.querySelectorAll(".subtabs a")].map(a=>a.firstChild.textContent.trim()).join(",")`);
ok('Discover pages show Swipe · Top 3 · Saved ('+tabsTxt+')', tabsTxt==='Swipe,Top 3,Saved');
const sp1 = await ev(`(()=>{const p=document.querySelector(".subtabs .sub-pill"), a=document.querySelector(".subtabs a.on"); return p&&a ? Math.abs(p.getBoundingClientRect().left-a.getBoundingClientRect().left) : -1})()`);
await ev(`document.querySelector('.subtabs a[data-sub="list"]').click(); true`); await sleep(700);
const sv = await ev(`(()=>{const p=document.querySelector(".subtabs .sub-pill"), a=document.querySelector(".subtabs a.on"); return {hash:location.hash, on:a.dataset.sub, cur:a.getAttribute("aria-current"), dx:Math.abs(p.getBoundingClientRect().left-a.getBoundingClientRect().left), navActive:document.querySelector(".topnav a.active").dataset.nav, title:document.title}})()`);
ok('Saved tab opens the saved list, and Discover stays lit up top '+JSON.stringify(sv), sp1>=0 && sp1<2 && sv.hash==='#/my-list' && sv.on==='list' && sv.cur==='page' && sv.dx<2 && sv.navActive==='discover' && sv.title==='Saved · Israel Gap Year Finder');
await ev(`location.hash="#/browse"; true`); await sleep(500);

// Quiz pickers: segmented single choices, check chips, the budget ruler, the card scroller, the floating bar.
await ev(`(()=>{const s=JSON.parse(localStorage.getItem("gyf:v1")); s.quiz={v:3,step:1,done:false,answers:{deal:{},prefs:{},field:[],city:[]}}; localStorage.setItem("gyf:v1",JSON.stringify(s)); location.hash="#/start"; location.reload(); return true})()`); await sleep(1300);
ok('Setting and Hebrew are segmented controls; communities are check chips', await ev(`!!document.querySelector('.qseg [data-key=gender]') && !!document.querySelector('.qseg [data-key=hebrew]') && document.querySelectorAll('.qchips [data-key=orientation] .qc-check').length===7`));
await ev(`document.querySelector('[data-act=deal-pick][data-key=hebrew][data-value=basic]').click(); true`); await sleep(300);
await ev(`document.querySelector('[data-act=deal-pick][data-key=hebrew][data-value=fluent]').click(); true`); await sleep(400);
const sp = await ev(`(()=>{const s=document.querySelector('.qseg [data-key=hebrew]').closest('.qseg'), p=s.querySelector('.seg-pill'), o=s.querySelector('.qchip.on'); const a=p.getBoundingClientRect(), b=o.getBoundingClientRect(); return {val:o.dataset.value, d:Math.round(Math.abs(a.left-b.left)+Math.abs(a.width-b.width))}})()`);
ok('the segment highlight slides to the new pick '+JSON.stringify(sp), sp.val==='fluent' && sp.d<=1);
await ev(`document.querySelector('[data-act=deal-pick][data-key=orientation][data-value=reform]').click(); true`); await sleep(60);
ok('a picked chip shows its check', await ev(`(()=>{const c=document.querySelector('.qchip.on[data-value=reform]'); return !!c && c.classList.contains('just-on') && getComputedStyle(c.querySelector('.qc-check')).width!=='0px'})()`));
await ev(`(()=>{const r=document.querySelector("[data-act=budget-range]"); r.value=25000; r.dispatchEvent(new Event("input",{bubbles:true})); return true})()`); await sleep(150);
ok('the budget ruler follows the slider', await ev(`Math.abs(+getComputedStyle(document.querySelector('.ruler-track')).getPropertyValue('--p') - 0.5) < 0.001 && /\\$25,000/.test(document.querySelector('.bs-val').textContent)`));
ok('the floating bar shows progress for this screen', await ev(`+getComputedStyle(document.querySelector('.quiz-foot')).getPropertyValue('--f') > 0 && getComputedStyle(document.querySelector('.quiz-foot')).position==='sticky'`));
await ev(`document.querySelector('[data-act=quiz-next]').click(); true`); await sleep(600);
ok('What matters is a scroller of 7 cards with dots', await ev(`document.querySelectorAll('.pcar .prow').length===7 && document.querySelectorAll('.pcar-pips .pip').length===7 && getComputedStyle(document.querySelector('.pcar')).overflowX==='auto'`));
await ev(`document.querySelector('[data-act=pref-pick][data-key=academics][data-value="3"]').click(); true`); await sleep(60);
ok('the meter fills up to the pick', await ev(`document.querySelectorAll('.pnum.lit[data-key=academics]').length===3 && document.querySelectorAll('.pnum.fill-in[data-key=academics]').length===3`));
await sleep(800);
ok('answering moves on to the next card', await ev(`document.querySelector('.pcar').scrollLeft > 50 && /^1 of 7/.test(document.querySelector('.pcar-count').textContent)`));
await ev(`(()=>{const s=JSON.parse(localStorage.getItem("gyf:v1")); s.quiz={v:3,step:0,done:true,answers:{}}; localStorage.setItem("gyf:v1",JSON.stringify(s)); location.hash="#/browse"; location.reload(); return true})()`); await sleep(1300);

// Desktop screenshot, then phone: pill off (menu is a grid), search button fits, no sideways scroll.
await ev(`document.activeElement && document.activeElement.blur(); true`);
await shot('motion-desktop');
await vp(390,850); await sleep(400);
ok('pill hidden on phones', await ev(`(()=>{const p=document.querySelector(".nav-pill"); return !p || getComputedStyle(p).opacity==="0"})()`));
ok('phone top bar has no sideways scroll', await ev(`document.documentElement.scrollWidth<=390`));
ok('phone buttons answer to a 44px tap area', await ev(`["qs-open","nav-toggle"].every(c=>getComputedStyle(document.querySelector("."+c),"::before").minHeight==="44px") && getComputedStyle(document.querySelector(".bcard .btn, .btn"),"::before").minHeight==="44px"`));
ok('search button is icon-only on phones', await ev(`getComputedStyle(document.querySelector(".qs-open-label")).display==="none"`));
await ev(`document.querySelector(".nav-toggle").click(); true`); await sleep(200);
ok('phone menu active tile keeps its own highlight', await ev(`!/rgba\\(0, 0, 0, 0\\)/.test(getComputedStyle(document.querySelector(".topnav a.active")).backgroundColor)`));
await shot('motion-mobile');
ok('no JS errors', errs.length===0);
console.log(out.join('\n')); process.exit(0);
