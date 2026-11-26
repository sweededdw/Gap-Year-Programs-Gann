// Real cost calculator on program pages: Masa grant rules, what the price covers, currency, typing, saving, Compare row.
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
const shot=async (n)=>{const r=await cmd('Page.captureScreenshot',{format:'png'}); writeFileSync(`${SP}/${n}.png`,Buffer.from(r.result.data,'base64'));};
const out=[]; const ok=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
await cmd('Page.enable'); await cmd('Runtime.enable'); await vp(1280,1000);
await cmd('Page.navigate',{url:B}); await sleep(600);
await ev('localStorage.clear(); localStorage.setItem("gyf:theme","sunset"); true');
const go=async h=>{ await ev(`location.hash=${JSON.stringify(h)}; true`); await sleep(500); };
const net=()=>ev('document.querySelector("#sec-cost .cc-net").textContent');
const has=t=>ev(`document.querySelector("#sec-cost").textContent.includes(${JSON.stringify(t)})`);
const type=async (k,v)=>{ await ev(`(()=>{const i=document.querySelector('#sec-cost [data-cost="${k}"]'); i.focus(); i.value=${JSON.stringify(v)}; i.dispatchEvent(new Event("input",{bubbles:true})); return true;})()`); await sleep(120); };
const pick=async (k,v)=>{ await ev(`(()=>{const s=document.querySelector('#sec-cost [data-cost="${k}"]'); if(s.type==="checkbox") s.checked=${JSON.stringify(v)}; else s.value=${JSON.stringify(v)}; s.dispatchEvent(new Event("change",{bubbles:true})); return true;})()`); await sleep(200); };

// Year Course: priced after the standard Masa grant, flights not included, insurance included
await go('#/program/year-course');
ok('program page has a Real cost section and tab', !!(await ev('!!document.querySelector("#sec-cost .costcalc")')) && await ev('[...document.querySelectorAll(".tabs a")].some(a=>a.textContent==="Real cost")'));
ok('tuition prefilled from the published price', await ev('document.querySelector("#sec-cost [data-cost=tuition]").value')==='32100');
ok('price already after Masa: grant not subtracted again', await has('already takes off the standard Masa grant') && !(await ev('[...document.querySelectorAll("#sec-cost .cc-line")].some(l=>/Masa grant/.test(l.textContent))')));
ok('reads what the price covers: flights out, insurance in', await has('Flights not included') && await has('Health insurance included') && !(await ev('!!document.querySelector("#sec-cost [data-cost=insurance]")')));
ok('flights added from New York at the middle of the 2026 fare range ($980)', await ev('document.querySelector("#sec-cost [data-cost=flightsOn]").checked') && await ev('document.querySelector("#sec-cost [data-cost=flights]").value')==='980');
ok(`estimate = tuition + flights ($33,080) (${await net()})`, (await net())==='$33,080');
await ev('document.getElementById("sec-cost").scrollIntoView(); scrollBy(0,-70); true'); await sleep(300); await shot('cost-yc');
await type('prog','5000');
ok('typing a scholarship updates the total right away', (await net())==='$28,080');
ok('typing keeps the cursor in the box', await ev('document.activeElement && document.activeElement.dataset.cost')==='prog');
ok('aid shown as a line with a minus', await ev('[...document.querySelectorAll("#sec-cost .cc-line")].some(l=>/Program scholarship/.test(l.textContent) && /−\\s?\\$5,000/.test(l.textContent))'));
await pick('city','lax');
ok('changing city switches the fare ($1,200 from LA)', await ev('document.querySelector("#sec-cost [data-cost=flights]").value')==='1200' && (await net())==='$28,300');
await pick('flightsOn', false);
ok('turning off flights removes them', (await net())==='$27,100' && !(await ev('!!document.querySelector("#sec-cost [data-cost=flights]")')));
await ev('location.reload(); true'); await sleep(900); await go('#/program/year-course');
ok('your numbers are saved for next time', await ev('document.querySelector("#sec-cost [data-cost=prog]").value')==='5000' && (await net())==='$27,100');

// Kivunim: round-trip airfare from New York is in the price
await go('#/program/kivunim');
ok('Kivunim: flights included, so not added', await has('Flights included') && !(await ev('document.querySelector("#sec-cost [data-cost=flightsOn]").checked')));

// A gap year program under 22: Masa academic gap grant, low end counted
await go('#/program/aardvark');
await ev('document.getElementById("sec-cost").scrollIntoView(); scrollBy(0,-70); true'); await sleep(300); await shot('cost-aardvark');
ok('gap year: Masa $600–$800 shown, $600 counted', await has('$600–$800') && await ev('[...document.querySelectorAll("#sec-cost .cc-line")].some(l=>/Masa grant/.test(l.textContent) && /\\$600/.test(l.textContent))'));
ok('meals not included: the program\'s own food budget note is shown', await has('₪1,000 a month'));
await pick('age','22');
ok('22 or older: bigger Masa range ($1,400)', await ev('[...document.querySelectorAll("#sec-cost .cc-line")].some(l=>/Masa grant/.test(l.textContent) && /\\$1,400/.test(l.textContent))'));
await pick('masaOff', true);
ok('not Masa-recognized: grant removed', !(await ev('[...document.querySelectorAll("#sec-cost .cc-line")].some(l=>/Masa grant/.test(l.textContent))')));

// Yeshiva under 22: no base Masa grant for Jewish studies; yeshiva-only funding listed
const yid = await ev('window.GYF_DATA.programs.find(p=>p.type==="yeshiva" && p.costUSD).id');
await go('#/program/'+yid);
ok(`yeshiva (${yid}) under 22: no base Masa grant, with the reason`, await has('No base grant counted') && await has('lists no base grant for Jewish studies'));
ok('yeshiva: ways to pay include NCSY Torah Fund and federal aid through a US college', await has('NCSY Torah Fund') && await has('Federal aid and 529 savings'));
ok('older amounts are flagged to confirm', await ev('[...document.querySelectorAll("#sec-cost .cc-list li")].some(l=>/confirm/.test(l.textContent))'));
await go('#/program/aardvark');
ok('gap program: yeshiva-only funding is left out', !(await has('NCSY Torah Fund')) && await has('Atlanta Israel Gap Year Fellowship'));

// Priced in shekels: converted at the stated rate, rate editable
await go('#/program/bnei-akiva-mechina');
ok('shekel price converted at ₪3.34 ($28,443)', await ev('document.querySelector("#sec-cost [data-cost=tuition]").value')==='28443' && await has('converted at ₪3.34'));
ok('mechina: Masa type not assumed', await has('No base grant counted'));
ok('exchange rate box is shown', !!(await ev('!!document.querySelector("#sec-cost [data-cost=rate]")')));

// Not published: no made-up total
const nid = await ev('window.GYF_DATA.programs.find(p=>p.costUSD==null && !/[₪£]|NIS/.test(p.costText)).id');
await go('#/program/'+nid);
ok(`unpublished price (${nid}): no total until you enter one`, (await net())==='—' && await has("hasn't published its price"));

// Compare shows the Masa grant row
await go('#/compare/aardvark,year-course,'+yid);
ok('Compare: Masa grant row', await ev('[...document.querySelectorAll(".cmp tbody th")].some(t=>/Masa grant/.test(t.textContent))') && /In the price/.test(await ev('[...document.querySelectorAll(".cmp tbody tr")].find(t=>/Masa grant/.test(t.querySelector("th").textContent)).textContent')));

// Phone
await vp(390,844); await go('#/program/aardvark'); await ev('document.getElementById("sec-cost").scrollIntoView(); scrollBy(0,-60); true'); await sleep(300);
ok('phone: no sideways scroll', await ev('document.documentElement.scrollWidth<=innerWidth'));
ok('phone: the total sits above the inputs', await ev('document.querySelector("#sec-cost .cc-out").getBoundingClientRect().top < document.querySelector("#sec-cost .cc-inputs").getBoundingClientRect().top'));
await shot('cost-phone');
ok('no JS errors', errs.length===0); if(errs.length) console.log(errs);
console.log(out.join('\n')); process.exit(0);
