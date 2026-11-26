// Community: profiles, organizations, "who's interested", privacy, admin hide, and the not-set-up state.
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
  if (d.method==='Page.javascriptDialogOpening') { out.push('FAIL unexpected dialog: '+d.params.message); cmd('Page.handleJavaScriptDialog',{accept:true}); }
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ev=async e=>(await cmd('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
const nav=async u=>{ await cmd('Page.navigate',{url:'about:blank'}); await sleep(100); await cmd('Page.navigate',{url:u}); await sleep(1100); }; // full reload even if only the #hash differs
const go=async h=>{ await ev(`location.hash=${JSON.stringify(h)}; true`); await sleep(500); };
const shot=async(n,w=1280,h=900)=>{ await cmd('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<500}); await sleep(250); const r=await cmd('Page.captureScreenshot',{format:'png'}); writeFileSync(`${SP}/${n}.png`,Buffer.from(r.result.data,'base64')); };
const out=[]; const ok=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
const T=(name)=>ev(`JSON.parse(localStorage.getItem('mock:t:${name}')||'[]')`);
const text=()=>ev(`document.getElementById('app').innerText`);
const click=async(sel)=>{ const r=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; e.click(); return true})()`); await sleep(400); return r; };
const noConfirm=()=>ev(`window.confirm=()=>true; true`);
await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Fetch.enable',{patterns:[{urlPattern:'*supabase-js*'}]});
await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});

// Logged in as uid-me, with three other students: two visible, one private.
const seed = {
  'mock:users': { 'me@x': { id:'uid-me', email:'me@x', password:'gapyear2027', confirmed:true, user_metadata:{ name:'Noa Levi' } } },
  'mock:session': { access_token:'tok-uid-me', user:{ id:'uid-me', email:'me@x', user_metadata:{ name:'Noa Levi' } } },
  'mock:t:profiles': [
    { user_id:'uid-b', display_name:'Maya K.', school:'Gann Academy', grad_year:2027, visible:true },
    { user_id:'uid-c', display_name:'Private Pat', school:'Secret School', grad_year:2027, visible:false },
    { user_id:'uid-d', display_name:'Eli R.', school:'Ramaz', grad_year:2028, visible:true },
  ],
  'mock:t:org_members': [ { user_id:'uid-b', org_id:'bbyo' }, { user_id:'uid-c', org_id:'bbyo' }, { user_id:'uid-d', org_id:'ncsy' } ],
  'mock:t:program_interest': [ { user_id:'uid-b', program_id:'aardvark' }, { user_id:'uid-c', program_id:'aardvark' }, { user_id:'uid-c', program_id:'kivunim' }, { user_id:'uid-d', program_id:'aardvark' }, { user_id:'uid-d', program_id:'kivunim' }, { user_id:'uid-d', program_id:'nativ' } ],
};
await nav(B+'/login'); await ev(`localStorage.clear(); ${Object.entries(seed).map(([k,v])=>`localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`).join('')} true`);
await nav(B+'/#/community');

ok('nav has Community and it is active', await ev(`document.querySelector('[data-nav=community]').classList.contains('active')`));
ok('Community page lists every organization', await ev(`document.querySelectorAll('.org-card').length`) === await ev(`window.GYF_ORGS.orgs.length`) && await ev(`window.GYF_ORGS.orgs.length`) >= 19);
ok('organizations are grouped by kind', await ev(`document.querySelectorAll('.comm-kind').length`) === 5);
ok('every organization has a website and at least one source', await ev(`window.GYF_ORGS.orgs.every(o=>/^https:\\/\\//.test(o.website) && o.sources.length && o.sources.every(u=>/^https:\\/\\//.test(u)))`));
ok('linked gap years all exist', await ev(`window.GYF_ORGS.orgs.every(o=>o.programs.every(id=>window.GYF_DATA.programs.some(p=>p.id===id)))`));
let t = await text();
ok('private student never appears anywhere', !/Private Pat|Secret School/.test(t));
ok('BBYO counts only visible students', /1 student →/.test(await ev(`[...document.querySelectorAll('.org-card')].find(c=>c.querySelector('h3').textContent==='BBYO').innerText`)));
ok('Popular: Aardvark first with 2 visible students', (await ev(`document.querySelector('.comm-rank li').innerText`)).replace(/\s+/g,' ').trim() === 'Aardvark Israel 2');
ok('new profile is private by default (box unchecked)', await ev(`document.getElementById('cp-visible').checked`) === false);
await shot('comm-page');

// Profile
await click('[data-act=comm-save]');
ok('empty name -> message, nothing saved', /Add a name/.test(await text()) && (await T('profiles')).length === 3);
await ev(`document.getElementById('cp-name').value='Look www.spam.example'; true`); await click('[data-act=comm-save]');
ok('link in name -> refused', /Links aren't allowed/.test(await text()) && (await T('profiles')).length === 3);
await ev(`document.getElementById('cp-name').value='Noa L.'; document.getElementById('cp-school').value='Gann Academy'; document.getElementById('cp-year').value='2027'; document.getElementById('cp-visible').checked=true; true`);
await click('[data-act=comm-save]');
let me = (await T('profiles')).find(p=>p.user_id==='uid-me');
ok('profile saved with name, school, year and visible', me && me.display_name==='Noa L.' && me.school==='Gann Academy' && me.grad_year===2027 && me.visible===true);
ok('saved message and "Visible to students"', /Other students can now see your profile/.test(await text()) && /Visible to students/.test(await text()));

// Groups
await click('[data-act=comm-join][data-id=bbyo]');
ok('joining BBYO saves the membership', (await T('org_members')).some(m=>m.user_id==='uid-me' && m.org_id==='bbyo'));
t = await text();
ok('"Students in your groups" shows Maya (and not the private student)', /Students in your groups/.test(t) && /Maya K\./.test(t) && !/Private Pat/.test(t));
ok('BBYO button now says Joined and the count is 2', await ev(`document.querySelector('[data-act=comm-join][data-id=bbyo]').getAttribute('aria-pressed')`)==='true' && /2 students →/.test(await ev(`[...document.querySelectorAll('.org-card')].find(c=>c.querySelector('h3').textContent==='BBYO').innerText`)));
await go('#/community/org/bbyo');
t = await text();
ok('org page: students list has Maya and you', /Students \(2\)/.test(t) && /Maya K\./.test(t) && /You/.test(t));
ok('org page: what BBYO students are looking at -> Aardvark', /What BBYO students are looking at/.test(t) && (await ev(`document.querySelector('.comm-rank li').innerText`)).includes('Aardvark'));
ok('org page: sources and official website', await ev(`!!document.querySelector('.sources a') && [...document.querySelectorAll('.actions a')].some(a=>a.href.startsWith('https://bbyo.org'))`));
await shot('comm-org');
await go('#/community/org/usy');
ok('USY page links Nativ (the gap year USY runs)', /Gap years run by USY/.test(await text()) && await ev(`!!document.querySelector('a[href="#/program/nativ"]')`));
await go('#/community/org/not-a-real-org');
ok('unknown org falls back to the main page', /Organizations/.test(await text()));

// Program page card
await go('#/program/aardvark'); await sleep(300);
t = await ev(`document.getElementById('comm-card').innerText`);
ok('program card: 2 students interested, names shown', /2 students interested/.test(t) && /Maya K\./.test(t) && /Eli R\./.test(t) && !/Private Pat/.test(t));
await click('#comm-card [data-act=comm-interest]');
ok("I'm interested saves the row", (await T('program_interest')).some(m=>m.user_id==='uid-me' && m.program_id==='aardvark'));
ok('card updates: 3 students, including you', /3 students interested, including you/.test(await ev(`document.getElementById('comm-card').innerText`)));
await shot('comm-card');
await click('#comm-card [data-act=comm-interest]');
ok('clicking again removes it', !(await T('program_interest')).some(m=>m.user_id==='uid-me' && m.program_id==='aardvark') && /2 students interested/.test(await ev(`document.getElementById('comm-card').innerText`)));
await click('#comm-card [data-act=comm-interest]');

// Private mode
await go('#/community');
await click('[data-act=comm-visible]');
ok('"Make private" turns the profile off', (await T('profiles')).find(p=>p.user_id==='uid-me').visible === false && /Private: only you/.test(await text()));
ok('your interests list says only you can see them', /Only you can see these/.test(await text()) && /Aardvark Israel/.test(await ev(`document.querySelector('.comm-mine').innerText`)));
await go('#/program/aardvark'); await sleep(200);
ok('program card warns that your interest is private', /Only you can see this/.test(await ev(`document.getElementById('comm-card').innerText`)));
await go('#/community');
await click('[data-act=comm-edit]');
ok('Edit keeps your answers in the form', await ev(`document.getElementById('cp-name').value`)==='Noa L.' && await ev(`document.getElementById('cp-year').value`)==='2027');
await ev(`document.getElementById('cp-visible').checked=true; true`); await click('[data-act=comm-save]');
ok('editing saves (visible again)', (await T('profiles')).find(p=>p.user_id==='uid-me').visible === true);

// Download my data includes community
await ev(`window.__blob=null; URL.createObjectURL=(b)=>{ window.__blob=b; return 'blob:x'; }; HTMLAnchorElement.prototype.click=function(){}; document.getElementById('acct-download').click(); true`); await sleep(600);
const dl = JSON.parse(await ev(`window.__blob ? window.__blob.text() : '{}'`));
ok('Download my data includes profile, groups and interests', dl.community && dl.community.profile.display_name==='Noa L.' && dl.community.organizations.join()==='bbyo' && dl.community.interestedIn.join()==='aardvark');

// Admin: hide and unhide
await ev(`localStorage.setItem('mock:admin','1'); true`); await nav(B+'/#/community'); await sleep(300);
ok('admins see Hide on other students', await ev(`!!document.querySelector('[data-act=comm-hide][data-id=uid-b]')`) && !(await ev(`!!document.querySelector('[data-act=comm-hide][data-id=uid-me]')`)));
await noConfirm(); await click('[data-act=comm-hide][data-id=uid-b]');
ok('Hide stores the ban', (await T('community_bans')).some(b=>b.user_id==='uid-b'));
ok('hidden student leaves the lists and shows under Hidden profiles', !/Maya K\./.test(await ev(`document.querySelector('.sections').innerText`)) && /Hidden profiles/.test(await text()));
await ev(`localStorage.removeItem('mock:admin'); true`); await nav(B+'/#/program/aardvark'); await sleep(300);
ok('for students, the hidden profile is gone from program pages too', !/Maya K\./.test(await ev(`document.getElementById('comm-card').innerText`)));
await ev(`localStorage.setItem('mock:admin','1'); true`); await nav(B+'/#/community'); await sleep(300);
await click('[data-act=comm-unhide][data-id=uid-b]'); await sleep(300);
ok('Unhide brings them back', !(await T('community_bans')).length && /Maya K\./.test(await ev(`document.querySelector('.sections').innerText`)));
await ev(`localStorage.removeItem('mock:admin'); true`); await nav(B+'/#/community'); await sleep(300);

// Phone
await shot('comm-phone', 390, 844);
ok('phone: no sideways scrolling on Community', await ev(`document.documentElement.scrollWidth <= 390`));
await go('#/community/org/bbyo'); await shot('comm-org-phone', 390, 844);
ok('phone: no sideways scrolling on an org page', await ev(`document.documentElement.scrollWidth <= 390`));
await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});

// Delete profile
await go('#/community'); await noConfirm(); await click('[data-act=comm-delete]'); await sleep(300);
ok('Delete profile removes profile, groups and interests', !(await T('profiles')).some(p=>p.user_id==='uid-me') && !(await T('org_members')).some(m=>m.user_id==='uid-me') && !(await T('program_interest')).some(m=>m.user_id==='uid-me'));
ok('other students are untouched', (await T('profiles')).length===3 && (await T('program_interest')).length===6);
ok('form is back for a new profile', await ev(`!!document.getElementById('cp-name')`));

// "Delete my saved data" also clears community rows
await click('[data-act=comm-join][data-id=ncsy]'); await go('#/program/kivunim'); await click('#comm-card [data-act=comm-interest]');
await noConfirm(); await ev(`document.getElementById('acct-delete').click(); true`); await sleep(900);
ok('"Delete my saved data" also clears your groups and interests', !(await T('org_members')).some(m=>m.user_id==='uid-me') && !(await T('program_interest')).some(m=>m.user_id==='uid-me'));

// Database not updated yet
await ev(`localStorage.setItem('mock:notable','1'); true`); await nav(B+'/#/community'); await sleep(300);
ok('before the migration: friendly "almost ready" message', /Community is almost ready/.test(await text()));
await go('#/program/aardvark'); await sleep(200);
ok('before the migration: program card says coming soon', /Coming soon/.test(await ev(`document.getElementById('comm-card').innerText`)));
await ev(`localStorage.removeItem('mock:notable'); true`);

ok('no page errors', errs.length === 0);
if (errs.length) out.push('   ' + errs.join('\n   '));
console.log(out.join('\n'));
process.exit(0);
