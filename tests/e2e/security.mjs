// Delete my account, Turnstile bot check on the login page, privacy page.
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2], B = 'http://localhost:3124', BT = 'http://localhost:3126';
const MOCK = readFileSync(new URL('../mock-supabase.js', import.meta.url), 'utf8');
// Stand-in for Cloudflare's script: renders a box, hands back a token, and gives a new one on reset.
const TURNSTILE = `window.turnstile={n:0,render:function(el,o){window.__ts=o;el.innerHTML='<div class="fake-ts">security check</div>';var t=this;setTimeout(function(){o.callback('cap-'+(++t.n))},50);return 'w1'},reset:function(){window.__tsResets=(window.__tsResets||0)+1;var t=this;setTimeout(function(){window.__ts.callback('cap-'+(++t.n))},50)}};window.__tsSrc=document.currentScript&&document.currentScript.src;if(window.onTurnstileReady)window.onTurnstileReady();`;
let list; for (let i=0;i<40;i++){ try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r=>setTimeout(r,250)); } }
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); const errs=[]; const requests=[];
const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
ws.onmessage = async m => { const d=JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method==='Fetch.requestPaused') { const body = /challenges\.cloudflare\.com/.test(d.params.request.url) ? TURNSTILE : MOCK; cmd('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(body).toString('base64')}); }
  if (d.method==='Network.requestWillBeSent') requests.push({ url: d.params.request.url, method: d.params.request.method, headers: d.params.request.headers });
  if (d.method==='Page.javascriptDialogOpening') { console.log('FAIL unexpected dialog: ' + d.params.message.slice(0,80)); cmd('Page.handleJavaScriptDialog',{accept:true}); }
  if (d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>{ const r=await cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true}); if (r.result?.exceptionDetails) console.log('eval error:', e.slice(0,80)); return r.result?.result?.value; };
const nav=async u=>{ await cmd('Page.navigate',{url:'about:blank'}); await sleep(80); await cmd('Page.navigate',{url:u}); await sleep(1200); };
const shot=async(n,w=1280,h=900)=>{ await cmd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<500}); await sleep(150); const r=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); writeFileSync(`${OUT}/${n}.png`,Buffer.from(r.result.data,'base64')); };
const ok=(n,c)=>console.log((c?'PASS ':'FAIL ')+n);
const fill=(o)=>ev(Object.entries(o).map(([k,v])=>`document.getElementById('${k}').value=${JSON.stringify(v)};`).join('')+'true');
const submit=async()=>{ await ev(`document.getElementById('auth-form').requestSubmit(); true`); await sleep(1100); };
const msg=()=>ev(`(document.getElementById('msg').hidden?'':document.getElementById('msg').textContent)`);
const path=()=>ev('location.pathname + location.search');
const J=(k)=>ev(`JSON.parse(localStorage.getItem(${JSON.stringify(k)})||'null')`);

await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Network.enable');
await cmd('Fetch.enable',{patterns:[{urlPattern:'*supabase-js*'},{urlPattern:'*challenges.cloudflare.com*'}]});
await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});

// --- no Turnstile key: no widget, no Cloudflare request ---
await nav(B+'/login'); await ev('localStorage.clear(); true'); await nav(B+'/login');
ok('bot check off: no widget and nothing loaded from Cloudflare', !(await ev(`!!document.querySelector('.auth-captcha')`)) && !requests.some(r=>/cloudflare/.test(r.url)));

// --- delete my account ---
await ev(`document.querySelector('[data-mode=signup]').click(); true`);
await fill({name:'Dana',email:'dana@example.com',password:'dana-pass-123'}); await submit();
await nav(B+'/#/browse');
await ev(`document.querySelector('.bcard .heart').click(); true`); await sleep(900);
ok('setup: student has saved data', Object.keys((await J('mock:rows'))['uid-0'].state.saved).length===1);
ok('delete account: shown in the account menu', !(await ev(`document.getElementById('acct-close').hidden`)));
await ev(`window.confirm=()=>true; window.prompt=()=>'delete'; document.getElementById('acct-close').click(); true`); await sleep(600);
ok('delete account: wrong confirmation word does nothing', (await path())==='/' && /not deleted/.test(await ev(`document.getElementById('banner').textContent`)) && !requests.some(r=>/delete-account/.test(r.url)));
await ev(`window.confirm=()=>false; document.getElementById('acct-close').click(); true`); await sleep(300);
ok('delete account: cancel does nothing', !requests.some(r=>/delete-account/.test(r.url)));
await ev(`window.confirm=()=>true; window.prompt=()=>'DELETE'; document.getElementById('acct-close').click(); true`); await sleep(1500);
const dreq = requests.find(r=>/\/api\/delete-account$/.test(r.url));
ok('delete account: POSTs to the server with the login token (never the secret key)', !!dreq && dreq.method==='POST' && /^Bearer tok-uid-0$/.test(dreq.headers.Authorization||dreq.headers.authorization||''));
ok('delete account: logged out and told it worked', (await path())==='/login?deleted=1' && /were deleted/.test(await msg()));
ok('delete account: nothing left in this browser', !(await J('mock:session')) && !(await ev(`Object.keys(localStorage).some(k=>k.indexOf('gyf:v1')===0)`)));
await shot('sec-deleted', 1280, 700);

// --- server refuses (e.g. token expired) ---
await ev(`document.querySelector('[data-mode=signup]').click(); true`);
await fill({name:'Eli',email:'eli@example.com',password:'eli-pass-1234'}); await submit();
await nav(B+'/#/');
await ev(`(()=>{const s=JSON.parse(localStorage.getItem('mock:session')); s.access_token='bad'; localStorage.setItem('mock:session',JSON.stringify(s)); return true})()`);
await ev(`window.confirm=()=>true; window.prompt=()=>'DELETE'; document.getElementById('acct-close').click(); true`); await sleep(1000);
ok('delete account: a refusal is explained and nothing is cleared', (await path())==='/' && /log in again/.test(await ev(`document.getElementById('banner').textContent`)) && !!(await J('mock:session')));

// --- Turnstile on ---
await nav(BT+'/login'); await ev('localStorage.clear(); true'); await nav(BT+'/login');
await sleep(400);
ok('bot check on: widget appears above the button', await ev(`!!document.querySelector('.auth-captcha .fake-ts') && document.querySelector('.auth-captcha').nextElementSibling.id==='submit'`));
ok('bot check on: Cloudflare script allowed by the CSP and loaded explicitly', /render=explicit/.test(await ev('window.__tsSrc||""')));
await shot('sec-turnstile', 1280, 800);
await ev(`document.querySelector('[data-mode=signup]').click(); true`);
await fill({name:'Ari',email:'ari@example.com',password:'ari-pass-1234'}); await submit();
ok('bot check on: sign-up sends the token', (await J('mock:lastCaptcha'))==='cap-1' && (await path())==='/');
await ev(`localStorage.removeItem('mock:session'); true`);
await nav(BT+'/login'); await sleep(400);
await fill({email:'ari@example.com',password:'wrong-pass'}); await submit();
ok('bot check on: log-in sends a token, then gets a fresh one after a failed try', /^cap-/.test(await J('mock:lastCaptcha')) && (await ev('window.__tsResets||0'))>=1);
const first = await J('mock:lastCaptcha'); await sleep(200);
await fill({password:'ari-pass-1234'}); await submit();
ok('bot check on: the retry uses a new token', (await J('mock:lastCaptcha'))!==first && (await path())==='/');
await ev(`localStorage.removeItem('mock:session'); true`);
await nav(BT+'/login'); await sleep(300);
await ev(`window.__ts['expired-callback'](); true`);
await fill({email:'ari@example.com',password:'ari-pass-1234'}); await submit();
ok('bot check on: an expired check blocks the request with a clear message', /finish the security check/.test(await msg()) && (await path())==='/login');
await ev(`window.__ts.callback('cap-fresh'); true`);
await ev(`document.querySelector('[data-mode=forgot]').click(); true`);
await fill({email:'ari@example.com'}); await submit();
ok('bot check on: reset link sends the token', /^cap-/.test(await J('mock:lastCaptcha')) && /reset link is on its way/.test(await msg()));

// --- privacy page ---
await nav(B+'/privacy');
ok('privacy page loads and covers storage, deletion and analytics', /What we store/.test(await ev('document.body.textContent')) && /Delete my account/.test(await ev('document.body.textContent')) && /Web Analytics/.test(await ev('document.body.textContent')));
ok('privacy page lists the contact email', await ev(`!!document.querySelector('a[href="mailto:israelgapyearfinder@gmail.com"]')`));
await shot('sec-privacy', 390, 900);
ok('privacy page fits a phone', !(await ev('document.documentElement.scrollWidth > window.innerWidth + 1')));
await nav(B+'/login');
ok('login page links to privacy', await ev(`!!document.querySelector('a[href="/privacy"]')`));
ok('login page has a contact link', await ev(`!!document.querySelector('a[href="mailto:israelgapyearfinder@gmail.com"]')`));

ok('no JS errors', errs.length===0); if(errs.length) console.log(errs.slice(0,5));
ws.close(); process.exit(0);
