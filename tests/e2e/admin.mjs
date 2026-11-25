// Admin page: editing program and college data, history, hide/show, new items, conflicts, error log, permissions.
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
const click=async(sel,wait=300)=>{ await ev(`document.querySelector(${JSON.stringify(sel)}).click(); true`); await sleep(wait); };
const clickText=async(t,wait=400)=>{ const r=await ev(`(()=>{const b=[...document.querySelectorAll('button, a')].find(x=>x.textContent.trim()===${JSON.stringify(t)}); if(!b) return false; b.click(); return true})()`); if(!r) console.log('no button:', t); await sleep(wait); };
const setField=(path,v)=>ev(`(()=>{const el=document.querySelector('[data-adm-field="${path}"]'); el.value=${JSON.stringify(v)}; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
const note=()=>ev(`[...document.querySelectorAll('.admin .callout')].map(c=>c.textContent).join(' | ')`);
const browseCount=async()=>{ await nav(B+'/#/browse'); return ev(`document.querySelectorAll('.bcard').length`); };
const TODAY = await (async()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })();

await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Fetch.enable',{patterns:[{urlPattern:'*supabase-js*'}]});
await vp(1280,900);

// --- a student (not an admin) ---
await nav(B+'/login'); await ev('localStorage.clear(); true');
await nav(B+'/login?mode=signup');
await ev(`document.getElementById('name').value='Student'; document.getElementById('email').value='s@example.com'; document.getElementById('password').value='student-pass-1'; document.getElementById('auth-form').requestSubmit(); true`); await sleep(1300);
const builtinCount = await browseCount();
ok('student: site works with empty edit tables (' + builtinCount + ' programs)', builtinCount >= 38);
ok('student: no "Edit site data" link', await ev(`document.getElementById('acct-admin').hidden`));
await nav(B+'/#/admin');
ok('student: #/admin says admins only, editor not loaded', /Admins only/.test(await text('#app')) && !(await ev(`!!window.GYF_ADMIN`)));
const denied = await ev(`(async()=>{ const sb = await window.GYF_SB(); const r = await sb.from('programs').insert({id:'x',data:{}}); return r.error && r.error.code })()`);
ok('student: the database refuses writes (row-level security)', denied === '42501');

// --- become an admin ---
await ev(`localStorage.setItem('mock:admin','1'); true`);
await nav(B+'/#/');
ok('admin: "Edit site data" appears in the account menu', !(await ev(`document.getElementById('acct-admin').hidden`)));
await nav(B+'/#/admin');
ok('admin: editor loads on demand', await ev(`!!window.GYF_ADMIN && !!document.querySelector('.admin-list')`));
ok('admin: lists every program', (await ev(`document.querySelectorAll('.admin-list li').length`)) === builtinCount);
await shot('admin-list');
await ev(`(()=>{const s=document.querySelector('[data-adm-input="search"]'); s.focus(); s.value='aard'; s.dispatchEvent(new Event('input',{bubbles:true})); return true})()`); await sleep(200);
ok('admin: search filters and keeps focus', (await ev(`[...document.querySelectorAll('.admin-list li')].every(li=>/aard/i.test(li.textContent)) && document.querySelectorAll('.admin-list li').length>0 && document.querySelectorAll('.admin-list li').length<5`)) && await ev(`document.activeElement.dataset.admInput==='search'`));

// --- edit a program ---
await nav(B+'/#/admin/programs/aardvark');
ok('editor: opens with the built-in values', (await ev(`document.querySelector('[data-adm-field="name"]').value`))==='Aardvark Israel' && /Built-in data/.test(await text('.admin-ed-head')));
await setField('costText', 'TEST cost text $1');
await setField('highlights', 'Line one\nLine two');
ok('editor: form changes show up in the all-fields JSON', /TEST cost text \$1/.test(await ev(`document.querySelector('[data-adm-json]').value`)));
await click('[data-adm-check]', 50);
await click('[data-adm="save"]', 600);
let rows = await T('programs');
ok('save: writes one row with the change and today as checked date', rows.length===1 && rows[0].id==='aardvark' && rows[0].data.costText==='TEST cost text $1' && rows[0].verified_at===TODAY && rows[0].data.details && rows[0].data.time);
ok('save: says it is live', /Saved/.test(await note()));
await nav(B+'/#/program/aardvark');
ok('site: the program page shows the edit', /TEST cost text \$1/.test(await text('#app')));
ok('site: "Last checked" shows today', (await text('#app')).includes('Last checked ' + new Date(TODAY+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})));
await nav(B+'/#/swipe');
await ev(`localStorage.setItem('mock:admin',''); true`);
await nav(B+'/#/program/aardvark');
ok('site: other students see the edit too', /TEST cost text \$1/.test(await text('#app')));
await ev(`localStorage.setItem('mock:admin','1'); true`);

// --- history ---
await nav(B+'/#/admin/programs/aardvark');
await setField('costText', 'Second version'); await click('[data-adm="save"]', 600);
await sleep(300);
const histN = await ev(`document.querySelectorAll('.admin-hist li').length`);
ok('history: the earlier version is kept', histN===1);
await click('[data-adm="hist-load"]', 300);
ok('history: loading puts the old version in the form, unsaved', (await ev(`document.querySelector('[data-adm-field="costText"]').value`))==='TEST cost text $1' && /Save to make it live/.test(await note()) && (await T('programs'))[0].data.costText==='Second version');
await click('[data-adm="save"]', 600);
ok('history: saving it restores it', (await T('programs'))[0].data.costText==='TEST cost text $1');

// --- validation ---
await ev(`(()=>{document.querySelector('.admin-json').open=true; const j=document.querySelector('[data-adm-json]'); const d=JSON.parse(j.value); d.costUSD='lots'; delete d.blurb; j.value=JSON.stringify(d); return true})()`);
await click('[data-adm="json-apply"]', 300);
const probs = await text('.admin-side .callout.bad');
ok('validation: bad fields are listed', /costUSD should be/.test(probs) && /Missing field: blurb/.test(probs));
const before = JSON.stringify(await T('programs'));
await click('[data-adm="save"]', 500);
ok('validation: save is blocked', JSON.stringify(await T('programs'))===before && /fix the problems/.test(await note()));
await ev(`(()=>{document.querySelector('[data-adm-json]').value='{not json'; return true})()`); await click('[data-adm="json-apply"]', 200);
ok('validation: invalid JSON is caught', /isn't valid JSON/.test(await note()));
await nav(B+'/#/admin/programs/aardvark'); // drop the bad draft

// --- hide / show ---
await clickText('Hide from site', 700);
ok('hide: saved as hidden', (await T('programs'))[0].data.hidden===true);
ok('hide: students no longer see it', (await browseCount())===builtinCount-1);
await nav(B+'/#/program/aardvark');
ok('hide: its page is gone too', !/Aardvark Israel/.test(await text('#app h1')));
await nav(B+'/#/admin/programs/aardvark');
await clickText('Show on site', 700);
ok('show: back on the site', (await browseCount())===builtinCount);

// --- undo all edits ---
await nav(B+'/#/admin/programs/aardvark');
await ev(`window.confirm=()=>true; true`);
await clickText('Undo all edits (back to built-in)', 700);
ok('undo: row removed, built-in values back', (await T('programs')).length===0 && (await ev(`document.querySelector('[data-adm-field="costText"]').value`))!=='TEST cost text $1');
await nav(B+'/#/program/aardvark');
ok('undo: the site shows the built-in data again', !/TEST cost text/.test(await text('#app')));

// --- new program (duplicate) ---
await nav(B+'/#/admin/programs/kivunim');
await ev(`window.prompt=()=>'Test New Program'; true`);
await clickText('Duplicate as a new program', 600);
ok('duplicate: opens an unsaved copy, starting hidden', /test-new-program$/.test(await ev('location.hash')) && /Not saved/.test(await text('.admin-ed-head')) && /Hidden/.test(await text('.admin')) && /Copied from/.test(await note()));
ok('duplicate: facts unique to the original are cleared', (await ev(`document.querySelector('[data-adm-field="website"]').value`))==='' && (await ev(`JSON.parse(document.querySelector('[data-adm-json]').value).details`))===null);
await shot('admin-editor');
await click('[data-adm="save"]', 600);
rows = await T('programs');
ok('duplicate: saved as hidden draft', rows.length===1 && rows[0].id==='test-new-program' && rows[0].data.hidden===true);
ok('duplicate: hidden draft not on the site', (await browseCount())===builtinCount);
await nav(B+'/#/admin/programs/test-new-program');
await clickText('Show on site', 600);
ok('show: blocked until required fields are filled', (await T('programs'))[0].data.hidden===true || /fix the problems/.test(await note()));
await nav(B+'/#/admin/programs/test-new-program');
await setField('website', 'https://example.org/'); await setField('blurb', 'A test program.');
await click('[data-adm="save"]', 500);
await clickText('Show on site', 700);
ok('show: new program goes live', (await T('programs'))[0].data.hidden!==true && (await browseCount())===builtinCount+1);
await nav(B+'/#/program/test-new-program');
ok('site: new program has its own page', /Test New Program/.test(await text('#app')));
await nav(B+'/#/admin/programs/test-new-program');
await ev(`window.confirm=()=>true; true`);
await clickText('Delete', 700);
ok('delete: new program removed', (await T('programs')).length===0 && (await browseCount())===builtinCount);

// --- two editors at once ---
await nav(B+'/#/admin/programs/hevruta');
await setField('costText', 'Mine'); await click('[data-adm="save"]', 500);
await setField('costText', 'Mine again');
await ev(`(()=>{const t=JSON.parse(localStorage.getItem('mock:t:programs')); t[0].updated_at='2099-01-01T00:00:00.000Z'; t[0].data.costText='Theirs'; localStorage.setItem('mock:t:programs',JSON.stringify(t)); return true})()`);
await click('[data-adm="save"]', 500);
ok('conflict: does not overwrite someone else\'s save', (await T('programs'))[0].data.costText==='Theirs' && /someone else saved/.test(await note()));
await ev(`localStorage.setItem('mock:t:programs','[]'); localStorage.setItem('mock:t:content_history','[]'); true`);

// --- colleges ---
await nav(B+'/#/admin/colleges');
const colN = await ev(`document.querySelectorAll('.admin-list li').length`);
ok('colleges: all listed (' + colN + ')', colN >= 150);
await nav(B+'/#/admin/colleges/' + encodeURIComponent('University of Florida'));
await ev(`(()=>{const s=document.querySelector('[data-adm-field="deferral"]'); s.value=JSON.stringify('case'); s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`); await sleep(200);
await setField('how', 'Email admissions (test).');
await setField('deadlineDate', '2027-05-01');
await click('[data-adm="save"]', 600);
rows = await T('colleges');
ok('colleges: saved with kind and fields', rows.length===1 && rows[0].id==='University of Florida' && rows[0].kind==='policy' && rows[0].data.deferral==='case' && rows[0].data.deadlineDate==='2027-05-01');
await nav(B+'/#/colleges');
await ev(`(()=>{const s=document.querySelector('[data-act="col-search"]')||document.querySelector('#app input[type=search]'); s.value='Florida'; s.dispatchEvent(new Event('input',{bubbles:true})); return true})()`); await sleep(400);
ok('colleges: the Colleges page shows the edit', /Email admissions \(test\)/.test(await text('#app')) || /Case by case|case-by-case/i.test(await text('#app')));
await nav(B+'/#/admin/colleges');
await ev(`window.prompt=()=>'Test College of Testing'; true`);
await click('[data-adm="new"]', 600);
await setField('source', 'https://example.edu/gap');
await click('[data-adm="save"]', 600);
ok('colleges: a new college can be added', (await T('colleges')).some(r=>r.id==='Test College of Testing'));
await nav(B+'/#/admin/colleges/' + encodeURIComponent('Test College of Testing'));
await ev(`(()=>{const s=document.getElementById('f-kind'); s.value='not_found'; s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
await click('[data-adm="save"]', 600);
ok('colleges: type can change to "no policy found"', (await T('colleges')).find(r=>r.id==='Test College of Testing').kind==='not_found');

// --- broken rows in the database don't break the site ---
await ev(`localStorage.setItem('mock:t:programs', JSON.stringify([{id:'aardvark', data:{id:'aardvark', name:'Broken'}, verified_at:null, updated_at:'2026-01-01T00:00:00Z'}])); localStorage.setItem('mock:t:client_errors','[]'); true`);
await nav(B+'/#/browse');
ok('bad edit row: skipped, built-in program still shown', (await ev(`document.querySelectorAll('.bcard').length`))===builtinCount && !(await text('#app')).includes('Broken'));
ok('bad edit row: reported in the error log', (await T('client_errors')).some(r=>/Skipped invalid program edit: aardvark/.test(r.message)));
await ev(`localStorage.setItem('mock:t:programs','[]'); true`);

// --- error log ---
await ev(`localStorage.setItem('mock:t:client_errors','[]'); true`);
await nav(B+'/#/browse');
await ev(`for (let i=0;i<8;i++) setTimeout(()=>{ throw new Error('boom-test-'+i) }, 10*i); true`); await sleep(500);
const logged = await T('client_errors');
ok('error log: errors are recorded with page and user', logged.length>0 && /boom-test-0/.test(logged[0].message) && logged[0].page==='/#/browse' && logged[0].user_id==='uid-0');
ok('error log: at most 5 per page load', logged.length===5);
await nav(B+'/#/admin/errors');
await sleep(300);
ok('error log: admins can read it on the Errors tab', (await ev(`document.querySelectorAll('.admin-errs li').length`))===5 && /boom-test-0/.test(await text('.admin-errs')));

// --- no tables yet (migration not run) ---
await ev(`localStorage.setItem('mock:notable','1'); true`);
await nav(B+'/#/browse');
ok('no edit tables: site still works on built-in data', (await ev(`document.querySelectorAll('.bcard').length`))===builtinCount && await ev(`document.getElementById('acct-admin').hidden`));
await ev(`localStorage.removeItem('mock:notable'); true`);

// --- phone ---
await vp(390, 900);
await nav(B+'/#/admin/programs/aardvark');
const overflow = await ev(`document.documentElement.scrollWidth > window.innerWidth + 1`);
ok('phone: editor fits the screen (no sideways scroll)', !overflow);
await shot('admin-editor-phone');

const real = errs.filter(e=>!/boom-test/.test(e||''));
ok('no unexpected JS errors', real.length===0); if(real.length) console.log(real.slice(0,5));
ws.close(); process.exit(0);
