// The login page: scenery that changes on its own, a first-visit choice screen, the forms, and the
// Google / Apple buttons that appear only when Supabase has them switched on.
import { readFileSync, writeFileSync } from 'node:fs';
const SP = process.argv[2], B = 'http://localhost:3124', MOCK = readFileSync(new URL('../mock-supabase.js', import.meta.url), 'utf8');
let list; for (let i=0;i<40;i++){ try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r=>setTimeout(r,250)); } }
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); const errs=[];
const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
ws.onmessage = async m => { const d=JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method==='Fetch.requestPaused') cmd('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(MOCK).toString('base64')});
  if (d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description);
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
const nav=async u=>{ await cmd('Page.navigate',{url:u}); await sleep(1200); };
const vp=(w,h)=>cmd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<500});
const shot=async n=>{ const r=await cmd('Page.captureScreenshot',{format:'png'}); writeFileSync(`${SP}/${n}.png`,Buffer.from(r.result.data,'base64')); };
const out=[]; const ok=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
const shown=(sel)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); return !!e && !!e.offsetParent})()`);
const txt=(sel)=>ev(`document.querySelector(${JSON.stringify(sel)})?.textContent||""`);
await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Fetch.enable',{patterns:[{urlPattern:'*supabase-js*'}]});
await vp(1366,820);

// ---- First visit: the choice screen ----
await nav(B+'/login'); await ev('localStorage.clear(); true'); await nav(B+'/login');
ok('first visit opens on the choice screen', /Find your gap year/.test(await txt('#title')) && await shown('.auth-choices') && !(await shown('#auth-form')));
ok('choices: email, guest, and Log in', await shown('.auth-choices [data-mode=signup]') && await shown('#guest') && await shown('.auth-choices [data-mode=login]'));
ok('no Google / Apple buttons when Supabase has only email on', await ev('document.getElementById("providers").hidden && !document.querySelector(".auth-provider")'));
ok('wide screens: photo panel on the left, sheet on the right', await ev('(()=>{const s=document.querySelector(".scene").getBoundingClientRect(), f=document.querySelector(".sheet-inner").getBoundingClientRect(); return s.width>500 && s.right<=f.left && s.height>700})()'));
ok('pieces of the screen come in one after another', await ev('(()=>{const r=[...document.querySelectorAll(".rise")]; return r.length>=4 && r.map(e=>+e.style.getPropertyValue("--i")).join()===r.map((_, i)=>i).join()})()'));
await shot('login-start');

// ---- Scenery ----
ok('six scenes with a dot each; the first photo loads at once', await ev('document.querySelectorAll(".scene-slide").length===6 && document.querySelectorAll(".scene-dot").length===6 && document.querySelector(".scene-slide img").complete'));
ok('only the first and next photos load up front', await ev('document.querySelectorAll(".scene-slide img[data-src]").length===4'));
await ev('document.querySelectorAll(".scene-dot")[2].click(); true'); await sleep(300);
ok('a dot jumps to its scene with its place and photo credit', await txt('#scene-place')==='Mitzpe Ramon' && /goni nachmani \/ Unsplash/.test(await txt('#scene-credit')) && await ev('document.querySelectorAll(".scene-slide")[2].classList.contains("on") && /j-g3z4-7V3w/.test(document.getElementById("scene-credit").href)'));
ok('the photo drifts slowly and the dot fills', await ev('(()=>{const i=getComputedStyle(document.querySelector(".scene-slide.on img")), d=getComputedStyle(document.querySelector(".scene-dot.on span"), "::after"); return i.animationName==="scene-drift" && parseFloat(i.animationDuration)>=6 && d.animationName==="scene-fill"})()'));
await ev('window.__p0=document.getElementById("scene-place").textContent; true'); await sleep(7200);
ok('scenes change on their own', await txt('#scene-place')!=='Mitzpe Ramon');
ok('the photo over the brand stays the light mark in Daylight', await ev('document.documentElement.setAttribute("data-theme","daylight"); /logo-mark\\.svg$/.test(document.querySelector(".scene-mark").getAttribute("src"))'));
await ev('document.documentElement.setAttribute("data-theme","sunset"); true');

// ---- Forms ----
await ev('document.querySelector(".auth-choices [data-mode=signup]").click(); true'); await sleep(350);
ok('Continue with email opens sign-up with a Back button', /Create your account/.test(await txt('#title')) && await shown('#name') && await shown('.auth-back'));
ok('show password', await ev('(()=>{const p=document.getElementById("password"), e=document.getElementById("pw-eye"); e.click(); const a=p.type==="text" && e.getAttribute("aria-pressed")==="true"; e.click(); return a && p.type==="password"})()'));
await ev('document.querySelector(".auth-back").click(); true'); await sleep(300);
ok('Back returns to the choice screen', /Find your gap year/.test(await txt('#title')) && await shown('.auth-choices'));
await nav(B+'/login?mode=signup');
ok('?mode=signup opens the sign-up form directly', /Create your account/.test(await txt('#title')));

// ---- Returning user ----
await ev('localStorage.setItem("gyf:has-account","1"); true'); await nav(B+'/login');
ok('someone who has logged in here before lands on Log in', /^Log in$/.test(await txt('#title')) && await shown('#email') && !(await shown('#name')));
await nav(B+'/login?deleted=1');
ok('after deleting the account, back to the first-visit screen', /Find your gap year/.test(await txt('#title')) && await ev('localStorage.getItem("gyf:has-account")===null'));

// ---- Google when Supabase has it on ----
const stub = await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const f=window.fetch; window.fetch=function(u,o){ if(String(u).indexOf("/auth/v1/settings")>=0) return Promise.resolve(new Response(JSON.stringify({external:{email:true,google:true,apple:false}}),{status:200,headers:{"Content-Type":"application/json"}})); return f.apply(this,arguments); };})();`});
await ev('localStorage.clear(); true'); await nav(B+'/login'); await sleep(300);
ok('Google switched on: a Continue with Google button, and no Apple', await shown('.auth-provider.p-google') && /Continue with Google/.test(await txt('.auth-provider.p-google')) && !(await ev('!!document.querySelector(".auth-provider.p-apple")')));
await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:stub.result.identifier});

// ---- Phone ----
await vp(390,844); await nav(B+'/login'); await sleep(300);
ok('phone: photo on top, sheet below, no sideways scroll', await ev('(()=>{const s=document.querySelector(".scene").getBoundingClientRect(), h=document.querySelector(".auth-sheet").getBoundingClientRect(); return s.top===0 && s.width===390 && h.top<s.bottom && document.documentElement.scrollWidth<=390})()'));
await shot('login-phone');
const tall = await ev('document.querySelector(".scene").getBoundingClientRect().height');
await ev('document.querySelector(".auth-choices [data-mode=login]").click(); true'); await sleep(500);
ok('phone: the photo steps back once a form is open', await ev('document.querySelector(".scene").getBoundingClientRect().height') < tall - 100 && await shown('#submit'));
await shot('login-phone-form');
ok('no JS errors', errs.length===0); if (errs.length) console.log(errs.slice(0,3).join('\n'));
console.log(out.join('\n')); process.exit(0);
