// Home › Contact: the email card, the suggestion form (guest and signed in), the email fallback when the
// table isn't there, the per-browser daily limit, the bot trap, and the admin's Suggestions tab.
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2], B = 'http://localhost:3124', MOCK = readFileSync(new URL('../mock-supabase.js', import.meta.url), 'utf8');
let list; for (let i=0;i<40;i++){ try { list = await (await fetch('http://localhost:9342/json/list')).json(); break; } catch { await new Promise(r=>setTimeout(r,250)); } }
const ws = new WebSocket(list.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend=new Map(); const errs=[];
const cmd=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
ws.onmessage = async m => { const d=JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method==='Fetch.requestPaused') cmd('Fetch.fulfillRequest',{requestId:d.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(MOCK).toString('base64')});
  if (d.method==='Page.javascriptDialogOpening') { console.log('FAIL unexpected dialog: ' + d.params.message.slice(0,80)); cmd('Page.handleJavaScriptDialog',{accept:true}); }
  if (d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>{ const r=await cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true}); if (r.result?.exceptionDetails) console.log('eval error:', e.slice(0,80), r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
const nav=async u=>{ await cmd('Page.navigate',{url:'about:blank'}); await sleep(80); await cmd('Page.navigate',{url:u}); await sleep(1200); };
const vp=(w,h)=>cmd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<500});
const shot=async(n)=>{ const r=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); writeFileSync(`${OUT}/${n}.png`,Buffer.from(r.result.data,'base64')); };
const ok=(n,c)=>console.log((c?'PASS ':'FAIL ')+n);
const T=(name)=>ev(`JSON.parse(localStorage.getItem('mock:t:${name}')||'[]')`);
const text=(sel)=>ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`);
const shown=(sel)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); return !!e && !!e.offsetParent})()`);
const fill=(msg, contact)=>ev(`(()=>{const f=document.querySelector('.ct-form'); f.message.value=${JSON.stringify(msg)}; f.contact.value=${JSON.stringify(contact||'')}; return true})()`);
const send=async(wait=500)=>{ await ev(`document.querySelector('.ct-form').requestSubmit(); true`); await sleep(wait); };
const noteText=()=>text('.ct-note');

await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Fetch.enable',{patterns:[{urlPattern:'*supabase-js*'}]});
await vp(1280,900);

// ---- A guest ----
await nav(B+'/login'); await ev('localStorage.clear(); true');
await nav(B+'/?guest=1#/contact');
ok('#/contact opens the Contact page with the Home tabs on Contact', /Contact/.test(await text('.contact-page h1')) && await ev(`document.querySelector('#app .subtabs a.on').dataset.sub==='contact'`));
ok('the page title says Contact', await ev('document.title')==='Contact · Israel Gap Year Finder');
ok('the top bar marks Home', await ev(`document.querySelector('.topnav a.active').dataset.nav==='home'`));
ok('the email card shows the address and a mail link', /israelgapyearfinder@gmail\.com/.test(await text('.ct-addr')) && await ev(`document.querySelector('.ct-email a.btn').getAttribute('href').indexOf('mailto:israelgapyearfinder@gmail.com')===0`));
ok('there is a suggestion section with four kinds', await shown('.ct-suggest') && await ev(`[...document.querySelectorAll('[data-ct=kind]')].map(b=>b.textContent).join(',')`)==='A program,A feature,A fix,Something else');
ok('on wide screens the two cards sit side by side', await ev(`(()=>{const a=document.querySelector('.ct-email').getBoundingClientRect(), b=document.querySelector('.ct-suggest').getBoundingClientRect(); return a.right<=b.left && Math.abs(a.top-b.top)<2})()`));
await sleep(600);
const pill = await ev(`(()=>{const p=document.querySelector('#app .subtabs .sub-pill'), a=document.querySelector('#app .subtabs a.on'); if(!p) return 'none'; const pr=p.getBoundingClientRect(), ar=a.getBoundingClientRect(); return {dx:Math.round(pr.left-ar.left), dw:Math.round(pr.width-ar.width)}})()`);
ok('the sub-tab highlight rests on Contact '+JSON.stringify(pill), pill==='none' || (Math.abs(pill.dx)<2 && Math.abs(pill.dw)<2));
await shot('contact');
await ev(`document.querySelector('[data-ct=kind][data-k=program]').click(); true`); await sleep(100);
const pillOn = (k)=>ev(`(()=>{const p=document.querySelector('.ct-kinds .seg-pill'), a=document.querySelector('.ct-kinds [data-k=${k}]'); if(!p) return 'none'; const pr=p.getBoundingClientRect(), ar=a.getBoundingClientRect(); return Math.abs(pr.left-ar.left)<2 && Math.abs(pr.top-ar.top)<2 && Math.abs(pr.width-ar.width)<2})()`);
await sleep(400);
ok('the highlight moves to the picked kind', await pillOn('program')===true);
await ev(`document.querySelector('[data-ct=kind][data-k=fix]').click(); true`); await sleep(400);
ok('and moves again on the next pick', await pillOn('fix')===true && await ev(`document.querySelector('[data-k=fix]').classList.contains('on') && !document.querySelector('[data-k=program]').classList.contains('on')`));
await ev(`document.querySelector('[data-ct=kind][data-k=program]').click(); true`); await sleep(400);
ok('picking a kind marks it and changes the hint', await ev(`(()=>{const b=document.querySelector('[data-ct=kind][data-k=program]'); return b.classList.contains('on') && b.getAttribute('aria-checked')==='true' && /Which program/.test(document.querySelector('.ct-msg').placeholder) && document.querySelectorAll('[data-ct=kind].on').length===1})()`));
await fill(''); await send(200);
ok('an empty suggestion is stopped with a note', /few words/.test(await noteText()) && (await T('suggestions')).length===0);
await fill('Please add Midreshet Example', 'not-an-email'); await send(200);
ok('a bad reply email is caught', /doesn.t look right/.test(await noteText()) && (await T('suggestions')).length===0);
await fill('Please add Midreshet Example', 'me@example.com'); await send();
const rows1 = await T('suggestions');
ok('a guest can send a suggestion', rows1.length===1 && rows1[0].kind==='program' && rows1[0].message==='Please add Midreshet Example' && rows1[0].contact==='me@example.com' && rows1[0].page==='/#/contact');
ok('the form is replaced by a thank-you', /Thanks, we got it/.test(await text('.ct-done')) && !(await ev(`!!document.querySelector('.ct-form')`)));
await ev(`document.querySelector('[data-ct=again]').click(); true`); await sleep(150);
ok('Send another brings back an empty form', await ev(`!!document.querySelector('.ct-form') && document.querySelector('.ct-msg').value===''`));

// Bot trap: the hidden field filled means nothing is saved.
await ev(`document.querySelector('.ct-form').website.value='http://spam'; true`); await fill('Buy things now'); await send();
ok('a bot that fills the hidden field is ignored', (await T('suggestions')).length===1 && /Thanks/.test(await text('.ct-done')));

// No table yet: offers email with the message filled in.
await nav(B+'/?guest=1#/contact');
await ev(`localStorage.setItem('mock:notable','1'); true`);
await fill('Dark mode for the map'); await send();
ok('if it can\'t be saved, it offers an email with the message in it', /Send it by email instead/.test(await noteText()) && await ev(`/body=Dark%20mode%20for%20the%20map/.test(document.querySelector('.ct-note a').href)`));
await ev(`localStorage.removeItem('mock:notable'); true`);

// Five a day per browser.
await ev(`localStorage.setItem('gyf:suggest-log', JSON.stringify([1,2,3,4,5].map(()=>Date.now()))); true`);
await fill('One more idea'); await send();
ok('after five in a day, it points to email instead', /most suggestions for one day/.test(await noteText()) && (await T('suggestions')).length===1);
await ev(`localStorage.removeItem('gyf:suggest-log'); true`);

// Phone: one column, no sideways scroll.
await vp(390,844); await nav(B+'/?guest=1#/contact');
await ev(`document.querySelector('[data-ct=kind][data-k=other]').click(); true`); await sleep(400);
ok('phone: the highlight follows the pick in the 2-by-2 grid', await pillOn('other')===true);
ok('phone: cards stack, no sideways scroll', await ev(`(()=>{const a=document.querySelector('.ct-email').getBoundingClientRect(), b=document.querySelector('.ct-suggest').getBoundingClientRect(); return b.top>=a.bottom && document.documentElement.scrollWidth<=390})()`));
await shot('contact-phone');
await vp(1280,900);

// ---- Signed in, then admin ----
await nav(B+'/login'); await ev(`(()=>{const keep=localStorage.getItem('mock:t:suggestions'); localStorage.clear(); localStorage.setItem('mock:t:suggestions', keep); return true})()`);
await nav(B+'/login?mode=signup');
await ev(`document.getElementById('name').value='Student'; document.getElementById('email').value='s@example.com'; document.getElementById('password').value='student-pass-1'; document.getElementById('auth-form').requestSubmit(); true`); await sleep(1300);
await nav(B+'/#/contact');
await fill('Show which colleges give credit'); await send();
const rows2 = await T('suggestions');
ok('a signed-in student sends one with their account attached', rows2.length===2 && rows2[1].kind==='feature' && !!rows2[1].user_id);
await nav(B+'/#/admin/suggestions');
ok('students don\'t see the admin page', /Admins only/.test(await text('#app')));
await ev(`localStorage.setItem('mock:admin','1'); true`);
await nav(B+'/#/admin/suggestions'); await sleep(600);
ok('admin: a Suggestions tab lists them, newest first, with a reply link', await ev(`(()=>{const li=[...document.querySelectorAll('.admin-ideas li')]; return li.length===2 && /colleges give credit/.test(li[0].textContent) && /Midreshet Example/.test(li[1].textContent) && !!li[1].querySelector('a[href="mailto:me@example.com"]') && /Program/.test(li[1].querySelector('.tag').textContent)})()`));
await shot('contact-admin');
await ev(`document.querySelector('.admin-ideas li [data-adm=idea-del]').click(); true`); await sleep(500);
ok('admin can delete one', (await T('suggestions')).length===1 && await ev(`document.querySelectorAll('.admin-ideas li').length`)===1);

ok('no JS errors', errs.length===0); if (errs.length) console.log(errs.slice(0,3).join('\n'));
process.exit(0);
