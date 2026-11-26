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
const go=async h=>{ await cmd('Page.navigate',{url:'about:blank'}); await sleep(100); await cmd('Page.navigate',{url:B+h}); await sleep(700); };
const txt=sel=>ev(`document.querySelector(${JSON.stringify(sel)})?.textContent||""`);
await cmd('Page.enable'); await cmd('Runtime.enable'); await vp(1280,1400);
await go('#/browse'); await ev('localStorage.clear(); true');
// Aardvark: the deep sections
await go('#/program/aardvark');
const tabs = await ev('[...document.querySelectorAll(".tabs a")].map(a=>a.textContent)');
ok('tabs: Overview, Time breakdown, Daily life, Real cost, Internships & tracks, Student stories, then application', tabs.slice(0,6).join("|")==="Overview|Time breakdown|Daily life|Real cost|Internships & tracks|Student stories" && tabs.includes("Deadlines"));
ok('Daily life: housing near Machane Yehuda, meals budget, 24/7 counselors', /Machane Yehuda/.test(await txt('#sec-life')) && /₪1,000/.test(await txt('#sec-life')) && /24\/7/.test(await txt('#sec-life')));
ok('Internships: how placements work + 16–20 hours + sectors + 4 tracks', /Placement coordinators/.test(await txt('#sec-tracks')) && /16–20 hours/.test(await txt('#sec-tracks')) && await ev('document.querySelectorAll("#sec-tracks .track").length')===4 && await ev('document.querySelectorAll("#sec-tracks .intern .chip").length')>=8);
ok('Student stories: testimonial + alumni contact placeholders', /Testimonials coming soon/.test(await txt('#sec-stories')) && /Alumni contacts coming soon/.test(await txt('#sec-stories')));
ok('details sources added to sidebar', /aardvarkisrael\.com\/jerusalem-apt/.test(await ev('document.querySelector(".sources").textContent')));
ok('Daily life is bullet points (more bullets than items, every bullet ends cleanly)', await ev('document.querySelectorAll("#sec-life .life-list li").length') > await ev('document.querySelectorAll("#sec-life .life-item").length') && await ev('[...document.querySelectorAll("#sec-life .life-list:not(.sched) li")].every(li=>/[.!?)”"]$/.test(li.textContent))'));
await go('#/program/year-course'); await ev('document.getElementById("sec-life").scrollIntoView(); window.scrollBy(0,-90); true'); await sleep(200); await shot('y-yc');
await go('#/program/aardvark');
await ev('document.getElementById("sec-life").scrollIntoView(); window.scrollBy(0,-90); true'); await sleep(200); await shot('y-aardvark');
// stories render when data exists (same object the app reads)
await ev(`GYF_STORIES.aardvark={testimonials:[{quote:"Best year of my life.",name:"Test S.",year:"2025–26",school:"Gann '25"}],contacts:[{name:"Test S.",role:"Alum",email:"test@example.com",note:"Ask me about the tech track."}]}; location.hash="#/program/hevruta"; true`); await sleep(300);
await ev('location.hash="#/program/aardvark"; true'); await sleep(400);
ok('testimonials + contact render from stories.js', /Best year of my life/.test(await txt('#sec-stories')) && !!(await ev('!!document.querySelector("#sec-stories a[href=\\"mailto:test@example.com\\"]")')));
// program with no details: only stories
await go('#/program/har-etzion');
ok('no Daily life when nothing is published (Har Etzion), stories still there', !(await ev('!!document.getElementById("sec-life")')) && !!(await ev('!!document.getElementById("sec-stories")')));
// yeshiva daily schedule
await go('#/program/ytva');
ok('YTVA schedule: one row per time, times in bold column', await ev('document.querySelectorAll("#sec-life .sched li").length')===8 && await ev('document.querySelector("#sec-life .sched .t").textContent')==='5:45');
await ev('document.getElementById("sec-life").scrollIntoView(); window.scrollBy(0,-90); true'); await sleep(200); await shot('y-ytva');
ok('YTVA: men-only yeshiva label + daily schedule', /Yeshiva · Men only/.test(await txt('.school-head .type-badge')) && /5:45 Chovat Hatalmidim/.test(await txt('#sec-life')));
await go('#/program/mtva');
ok('MTVA: women-only seminary label', /Seminary · Women only/.test(await txt('.school-head .type-badge')));
// FZY: audience + pounds
await go('#/program/fzy-year-course');
ok('FZY: "Who it\'s for" callout + priced in pounds', /Who it's for:.*Young Judaea/.test(await txt('#sec-overview')) && /Priced in pounds/.test(await txt('.stats')) && /£23,499/.test(await txt('.stats')));
ok('program header shows the restriction label (UK-specific)', /UK-specific/.test(await txt('.school-head .aud-tag')));
await shot('y-fzy');
// Garin Tzabar: null end date doesn't break passport check
await go('#/program/garin-tzabar');
await ev(`(()=>{const i=document.querySelector('input[type=date][data-bind*="passportExpiry"]'); i.value="2028-01-01"; i.dispatchEvent(new Event("change",{bubbles:true})); return true})()`); await sleep(300);
ok('no end date -> passport warning instead of a crash', /hasn't published its end date/.test(await txt('#sec-docs')));
// Browse: audience tags + aliyah type
await go('#/browse');
ok('browse card shows restriction label (FZY: UK-specific)', /UK-specific/.test(await ev('document.querySelector(\'.bcard[data-href="#/program/fzy-year-course"] .aud-tag\')?.textContent||""')));
ok('FZY card price in pounds (£23.5k)', /£23\.5k/.test(await ev('document.querySelector(\'.bcard[data-href="#/program/fzy-year-course"] .bcard-facts\').textContent')));
await ev('document.querySelector("[data-act=toggle-filters]").click(); true'); await sleep(200);
ok('Aliyah & IDF type filter (1 program)', /Aliyah & IDF\s*1/.test(await ev('document.querySelector(".filters-panel [data-value=aliyah]")?.textContent||""')));
await ev('document.querySelector(".filters-panel [data-value=aliyah]").click(); true'); await sleep(200);
ok('aliyah filter shows Garin Tzabar only', await ev('document.querySelectorAll(".bcard").length')===1 && /Garin Tzabar/.test(await txt('.bcard h3')));
await vp(390,900); await go('#/program/aardvark'); await ev('document.getElementById("sec-tracks").scrollIntoView(); true'); await sleep(200); await shot('y-mobile');
ok('no JS errors', errs.length===0); if(errs.length) console.log(errs);
console.log(out.join('\n')); process.exit(0);
