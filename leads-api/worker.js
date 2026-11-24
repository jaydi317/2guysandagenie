// 2 Guys lead portal: the shared record behind /admin/leads/.
// Every route under /admin/api/ sits behind the Admin sign-in (Cloudflare Access); the Worker checks the sign-in token itself too.
// /admin/api/leads   GET   every shop, its stage, who's working it, notes and history
// /admin/api/act     POST  one change: did, undo, stage, note, email, claim, add, and for mail and email: piece, pieceback, draft, words, dnc
// /hooks/ghl         POST  GoHighLevel tells us something happened (needs ?key=)
// Every few minutes (cron): run queued jobs (import, load into GoHighLevel) and pull stage changes made in GoHighLevel.
// No shop is named in this file. The records live in the D1 database, never in the site's files.

const STAGES = ['Not touched yet', 'Slydial sent', 'Tried, no owner yet', 'Talked to the owner', '15 minutes booked', '15 minutes done', 'Offer made', 'Client', 'Not now'];
const PEOPLE = { 'daegan@maximum-leverage.com': 'Daegan', 'daegansmith@me.com': 'Daegan', 'jimmydavisprivate@gmail.com': 'Jimmy', 'paul@2guysandagenie.com': 'Paul' };
const GHL = 'https://services.leadconnectorhq.com';
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const b64 = x => { x = x.replace(/-/g, '+').replace(/_/g, '/'); x += '='.repeat((4 - x.length % 4) % 4); return Uint8Array.from(atob(x), c => c.charCodeAt(0)); };
let ready = false, certs = null, certsAt = 0;

// The seven pieces, in the order an owner gets them (Draft 6, Nov 23). Only used to fill an empty database once.
// Mail pieces have one version (sender "Any"). Each email has a version per sender; only Paul's is written so far.
// [First Name]: with no owner name on file, the greeting line is left off and the piece just starts.
const SEED = [
{ pid: 'postcard', sender: 'Any', ord: 1, kind: 'mail', name: 'Postcard', tip: 'The QR code is added to the card in a later build step. Nothing for you to do about it.', body:
`FRONT

2GuysAndAGenie.com

FACT: Nobody Wants To Be Told Their Baby's Ugly.

But It Might Be What You Need To Hear Most. Especially Right Now...

BACK

Right now, AI can take jobs off an owner's plate that used to eat hours every week.

Most owners around here haven't seen it yet. The first ones who do get a head start on everyone else.

I told a handyman named Jamon Jack that nobody would ever find his business with the name on his van. Here's how he tells it:

"Now, I'm a retired cop. I don't trust you. And nobody wants to hear their baby's ugly."

Then we put AI to work for him. His business was doing $15,000 a month. Jamon again:

"...now our revenue is over $50,000 a month."

I'm Jimmy. My partner is Paul, and we're right here in Fishers.

A letter from us is on its way. Can't wait? Scan the code and tell us the one job you'd love off your plate.

[QR] 2GuysAndAGenie.com/free15 · (317) 751-2693` },
{ pid: 'letter1', sender: 'Any', ord: 2, kind: 'mail', name: 'Letter 1', body:
`Dear [First Name],

A few days ago I sent you a postcard. It said nobody wants to be told their baby's ugly. I promised a letter, and this is it.

My name is Jimmy Davis, and my partner is Paul Lorkowski. We're right here in Fishers. We've been helping the businesses around here with AI, making the business better and the owner's life easier.

It all started with a coincidence. A man named Jamon Jack came to build a gazebo in my backyard. I looked at the name on his van and told him nobody would ever find his business with it. Jamon is a retired Indianapolis cop. He wanted to punch me in the face.

Then I showed him what I meant, and we went to work. His business went from $15,000 a month to over $50,000.

After that, Paul and I decided to help other owners around here. A pizza shop that now answers every call. Jim's Amazing Bread. Dr. Marcus McCray, the team chiropractor for the Indianapolis Colts, whose practice runs on referrals. They're real, they're local, and you can look every one of them up at 2GuysAndAGenie.com.

So this letter is simply the two of us introducing ourselves.

I know AI can feel like one more thing on a full plate, the kind of thing that waits until tomorrow. It's what we love to do, so it never has to be one more thing for you.

We'd rather show you than tell you. Pick one thing in your business you don't want to do anymore, and give us 15 minutes on the phone. We'll listen and ask every question we can think of. Then we'll go find the answer, or build it, and bring it back to you.

That way, the next time you think, "Maybe AI could solve this," you'll know who to call. It's us, Jimmy and Paul at 2 Guys and a Genie.

One of us will probably call this week, or stop in to say hello.

Sincerely,

Jimmy Davis, with Paul Lorkowski
2 Guys and a Genie · 2GuysAndAGenie.com · (317) 751-2693

P.S. If you'd rather not wait for our call, pick a time at 2GuysAndAGenie.com/free15.` },
{ pid: 'email1', sender: 'Paul', ord: 3, kind: 'email', name: 'Email 1', subj: 'Paul Lorkowski, from Fishers', body:
`Hi [First Name],

My name is Paul Lorkowski.

I ran a business here in Hamilton County for 20 years before I sold it.

Now my partner Jimmy and I help local owners put AI to work in their businesses.

I'm writing to introduce myself before I call or stop by this week.

If there's one job in your business you'd love to get off your plate, I'd like to hear about it.

That's usually the first thing we help with.

You can reply to this email, or call us at (317) 751-2693.

Paul

2GuysAndAGenie.com` },
{ pid: 'letter2', sender: 'Any', ord: 4, kind: 'mail', name: 'Letter 2', body:
`Dear [First Name],

I wrote to you last week to introduce Paul and me. I'm writing again with an invitation.

On Thursday, December 10, we're hosting an evening for local business owners at Launch Fishers. It's free, and we're buying the pizza.

This will be our third. Owners come after work, eat, and meet each other. Then Paul and I spend about an hour showing what AI can do in a business today, starting with the basics. After that, the room is yours. You take out your phone, pick something from your own business, and we walk around and help you with it.

Roger, a local owner, told us after the last one: "This was not talking about AI. This was actually helping people use AI."

Doors open at 6:30. We start at 7 and finish by 9. Launch Fishers is at 12175 Visionary Way.

You can save a seat at 2GuysAndAGenie.com/meetup. Or call us at (317) 751-2693 and I'll put your name down myself.

And if there's still one thing in your business you'd like fixed, my offer from the first letter stands. Tell us what it is.

I hope to meet you on the 10th.

Jimmy Davis, with Paul Lorkowski

P.S. Come at 6:30 if you want pizza. It goes fast.` },
{ pid: 'email2', sender: 'Paul', ord: 5, kind: 'email', name: 'Email 2', subj: 'an invitation for December 10', body:
`Hi [First Name],

It's Paul Lorkowski again.

Jimmy and I are hosting an evening for local business owners on Thursday, December 10, at Launch Fishers.

It's free, and we're buying the pizza.

We spend about an hour showing what AI can do in a business, then help each owner try it on something of their own.

Doors open at 6:30, and we're done by 9.

I'd like to have you there.

If you'd like to come, reply and I'll save you a seat myself.

Paul

2GuysAndAGenie.com` },
{ pid: 'letter3', sender: 'Any', ord: 6, kind: 'mail', name: 'Letter 3', tip: 'Found something on this shop? (See What We Found, under the words.) Change the paragraph that starts "I don\'t know what yours is yet" to "I took a look at your business, and one thing stood out:" and the finding, in plain words.', body:
`Dear [First Name],

This is my third letter, so I'll keep it short.

There's a saying: small hinges swing big doors. In my experience, that's how a business changes. One small thing first.

For Jamon, the handyman I told you about, it was his name. His van said T-J-O-A-T. We changed it to GottaCallJack.com. "I don't even have to give people my number anymore," he says. Everything else followed from that.

For the pizza shop, it was the phone. For the baker, it was the box he shipped in.

I don't know what yours is yet. It might be a name. It might be the calls you miss, the quotes you write at night, or a website that doesn't show how good you are.

I'd like to find out. Give Paul and me 15 minutes and tell us the one thing you want fixed. We'll come back and show you how we'd handle it. It costs you nothing.

Your week gets a little lighter. And we're a little happier for having done it.

You can call us at (317) 751-2693, or pick a time at 2GuysAndAGenie.com/free15.

Jimmy Davis, with Paul Lorkowski

P.S. Jamon was just one domain name away. You could be too.` },
{ pid: 'email3', sender: 'Paul', ord: 7, kind: 'email', name: 'Email 3', subj: 'one thing', body:
`Hi [First Name],

Paul Lorkowski here, one more time.

I've sent a couple of notes, so I'll keep this one short.

Jimmy and I started this business after one small change set a local owner's business on a new course.

We'd like the chance to find that one thing for you.

If something in your business comes to mind, reply and tell me what it is.

I'll take it from there.

And if you'd rather I stop writing, just say so.

Paul

2GuysAndAGenie.com` },
];

async function init(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, g TEXT, n TEXT, k TEXT, t TEXT, a TEXT, p TEXT, u TEXT, e TEXT, rt REAL, rv INTEGER, mi REAL, w TEXT, f TEXT, src TEXT, custom INTEGER DEFAULT 0, st TEXT, wk TEXT, note TEXT, gc TEXT, go TEXT, gs TEXT, gn TEXT, upd INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS ev (id INTEGER PRIMARY KEY AUTOINCREMENT, lead TEXT, ts INTEGER, who TEXT, a TEXT, p TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS ev_lead ON ev (lead, id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS leads_go ON leads (go)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS leads_gc ON leads (gc)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, arg TEXT, done INTEGER DEFAULT 0, out TEXT, ts INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS jobs_done ON jobs (done, id)'),
    // Mail and email (step 1, Nov 23): the seven pieces, what went to each shop, drafts, and "do not contact".
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pieces (pid TEXT, sender TEXT, ord INTEGER, kind TEXT, name TEXT, subj TEXT, body TEXT, tip TEXT, upd INTEGER, PRIMARY KEY (pid, sender))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS sends (id INTEGER PRIMARY KEY AUTOINCREMENT, lead TEXT, pid TEXT, who TEXT, ts INTEGER, st TEXT, dest TEXT, subj TEXT, body TEXT, why TEXT, mode TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS sends_lead ON sends (lead, pid, id)'),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS sends_once ON sends (lead, pid) WHERE st IN ('sent','ready','mailed')"),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS drafts (lead TEXT, pid TEXT, who TEXT, ts INTEGER, subj TEXT, body TEXT, PRIMARY KEY (lead, pid))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS flags (lead TEXT PRIMARY KEY, dnc INTEGER DEFAULT 0, who TEXT, ts INTEGER, why TEXT)'),
  ]);
  // The pieces' starting words go in once. After that the database is the master copy, so they can change without a code change.
  // A piece already in the database is never overwritten from here; a new piece or a new sender's version is added.
  const have = await env.DB.prepare('SELECT pid, sender FROM pieces').all(), got = new Set(have.results.map(r => r.pid + '|' + r.sender)), add = SEED.filter(p => !got.has(p.pid + '|' + p.sender));
  if (add.length) { const s = env.DB.prepare('INSERT OR IGNORE INTO pieces (pid,sender,ord,kind,name,subj,body,tip,upd) VALUES (?,?,?,?,?,?,?,?,?)'); await env.DB.batch(add.map(p => s.bind(p.pid, p.sender, p.ord, p.kind, p.name, p.subj || '', p.body, p.tip || '', Date.now()))); }
  ready = true;
}

// Who is signed in, from the Access token. Returns their first name, or null.
async function who(req, env) {
  const t = req.headers.get('Cf-Access-Jwt-Assertion'); if (!t) return null;
  const [h, p, s] = t.split('.'); if (!s) return null;
  let head, pay; try { head = JSON.parse(new TextDecoder().decode(b64(h))); pay = JSON.parse(new TextDecoder().decode(b64(p))); } catch (e) { return null; }
  for (let i = 0; i < 2; i++) {
    if (!certs || Date.now() - certsAt > 3600e3 || i) { const r = await fetch(`https://${env.TEAM}/cdn-cgi/access/certs`); certs = (await r.json()).keys || []; certsAt = Date.now(); }
    const jwk = certs.find(k => k.kid === head.kid); if (!jwk) continue;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(s), new TextEncoder().encode(h + '.' + p));
    if (!ok) return null;
    if (![].concat(pay.aud || []).includes(env.AUD) || (pay.exp || 0) * 1000 < Date.now()) return null;
    const em = String(pay.email || '').toLowerCase();
    return PEOPLE[em] || null;
  }
  return null;
}

async function all(env, me) {
  const [L, E, P, S, D, F] = await env.DB.batch([
    env.DB.prepare('SELECT id,g,n,k,t,a,p,u,e,rt,rv,mi,w,f,src,custom,st,wk,note,gc FROM leads ORDER BY id'),
    env.DB.prepare('SELECT lead,ts,who,a,p FROM ev ORDER BY id'),
    env.DB.prepare('SELECT pid,sender,ord,kind,name,subj,body,tip FROM pieces ORDER BY ord, sender'),
    env.DB.prepare("SELECT id,lead,pid,who,ts,st,dest,why,mode FROM sends WHERE st<>'taken back' ORDER BY id"),
    env.DB.prepare('SELECT lead,pid,who,ts,subj,body FROM drafts'),
    env.DB.prepare('SELECT lead,dnc,who,ts,why FROM flags WHERE dnc=1'),
  ]);
  const H = {}; for (const e of E.results) (H[e.lead] = H[e.lead] || []).push({ ts: e.ts, by: e.who, a: e.a, p: e.p });
  // Per shop: ps = every mail or email record (the words themselves come from op "words"), dr = drafts by piece, dnc = do not contact.
  const PS = {}, DR = {}, DN = {};
  for (const s of S.results) (PS[s.lead] = PS[s.lead] || []).push({ id: s.id, pid: s.pid, by: s.who, ts: s.ts, st: s.st, to: s.dest, why: s.why, mode: s.mode });
  for (const d of D.results) (DR[d.lead] = DR[d.lead] || {})[d.pid] = { by: d.who, ts: d.ts, subj: d.subj, body: d.body };
  for (const f of F.results) DN[f.lead] = { by: f.who, ts: f.ts, why: f.why };
  return { me, ghl: !!env.GHL_TOKEN, pieces: P.results, leads: L.results.map(x => ({ ...x, st: x.st || STAGES[0], h: H[x.id] || [], ps: PS[x.id] || [], dr: DR[x.id] || {}, dnc: DN[x.id] || null })) };
}

// ---------- GoHighLevel (only runs once GHL_TOKEN is set) ----------
function cfg(env) { try { return JSON.parse(env.GHL_CFG || '{}'); } catch (e) { return {}; } }
async function ghl(env, method, path, body) {
  const r = await fetch(GHL + path, { method, headers: { authorization: 'Bearer ' + env.GHL_TOKEN, version: '2021-07-28', accept: 'application/json', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch (e) {}
  if (!r.ok) throw new Error(method + ' ' + path.split('?')[0] + ' ' + r.status + ' ' + txt.slice(0, 200));
  return j;
}
function status(st) { return st === 'Client' ? 'won' : st === 'Not now' ? 'lost' : 'open'; }
// Make sure the shop is a contact with a deal card in GoHighLevel, and keep the pair of ids.
async function ensure(env, x) {
  const c = cfg(env); let gc = x.gc, go = x.go;
  if (!gc) {
    const m = /^(.*?),\s*([^,]+),\s*IN\s*(\d{5})?/.exec(x.a || '') || [];
    const body = { locationId: c.location, firstName: x.n, companyName: x.n, address1: m[1] || x.a || undefined, city: m[2] || x.t || undefined, state: 'IN', postalCode: m[3] || undefined, website: x.u || undefined, email: x.e || undefined, source: 'Local Business Database', dnd: true,
      tags: ['prospect list', 'prospect tier ' + String(x.g || '').toLowerCase()],
      customFields: [[c.f.id, x.id], [c.f.tier, x.g || ''], [c.f.kind, x.k || ''], [c.f.found, x.f || ''], [c.f.why, x.w || '']].map(([id, v]) => ({ id, fieldValue: v, field_value: v })) };
    const d = (x.p || '').replace(/\D/g, ''); if (d.length === 10) body.phone = '+1' + d;
    // Someone with this phone may already be in GoHighLevel (a registrant, a client). Never overwrite them:
    // no tag wipe, no do-not-disturb. Just link, add our tags and fill in our own fields.
    let ex = null;
    if (body.phone) { try { ex = (await ghl(env, 'GET', `/contacts/search/duplicate?locationId=${c.location}&number=${encodeURIComponent(body.phone)}`)).contact || null; } catch (e) {} }
    if (ex && ex.id) {
      gc = ex.id;
      await ghl(env, 'PUT', '/contacts/' + gc, { customFields: body.customFields });
      await ghl(env, 'POST', '/contacts/' + gc + '/tags', { tags: body.tags });
    } else {
      const r = await ghl(env, 'POST', '/contacts/', body);
      gc = (r.contact || {}).id; if (!gc) throw new Error('no contact id');
    }
  }
  const stage = c.stages[x.st || STAGES[0]];
  if (!go) {
    const r = await ghl(env, 'POST', '/opportunities/', { locationId: c.location, pipelineId: c.pipeline, pipelineStageId: stage, name: x.n, status: status(x.st), contactId: gc });
    go = (r.opportunity || {}).id;
  }
  await env.DB.prepare('UPDATE leads SET gc=?, go=?, gs=? WHERE id=?').bind(gc, go || null, stage, x.id).run();
  return { gc, go };
}
async function push(env, id, line) {
  if (!env.GHL_TOKEN) return;
  try {
    const x = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first(); if (!x) return;
    const c = cfg(env), had = x.go, { gc, go } = await ensure(env, x), stage = c.stages[x.st || STAGES[0]];
    if (go && had && x.gs !== stage) { await ghl(env, 'PUT', '/opportunities/' + go, { pipelineStageId: stage, status: status(x.st) }); await env.DB.prepare('UPDATE leads SET gs=? WHERE id=?').bind(stage, id).run(); }
    if (line) await ghl(env, 'POST', '/contacts/' + gc + '/notes', { body: line });
  } catch (e) { await env.DB.prepare('INSERT INTO jobs (kind,arg,done,out,ts) VALUES (?,?,1,?,?)').bind('ghl-error', id, String(e).slice(0, 400), Date.now()).run(); }
}
async function pushNote(env, id) {
  if (!env.GHL_TOKEN) return;
  try {
    const x = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first(); if (!x || !(x.note || '').trim()) return;
    const { gc } = await ensure(env, x), body = { body: 'Lead portal notes:\n' + x.note };
    if (x.gn) await ghl(env, 'PUT', '/contacts/' + gc + '/notes/' + x.gn, body);
    else { const r = await ghl(env, 'POST', '/contacts/' + gc + '/notes', body); const gn = (r.note || {}).id; if (gn) await env.DB.prepare('UPDATE leads SET gn=? WHERE id=?').bind(gn, id).run(); }
  } catch (e) { await env.DB.prepare('INSERT INTO jobs (kind,arg,done,out,ts) VALUES (?,?,1,?,?)').bind('ghl-error', id, String(e).slice(0, 400), Date.now()).run(); }
}
// Stage changes made inside GoHighLevel come back to the portal.
async function pull(env) {
  if (!env.GHL_TOKEN) return;
  const c = cfg(env), back = {}; for (const k in c.stages) back[c.stages[k]] = k;
  const { results: have } = await env.DB.prepare("SELECT id,st,gs,go FROM leads WHERE go IS NOT NULL AND go<>''").all();
  const byGo = {}; for (const h of have) byGo[h.go] = h;
  for (let page = 1; page <= 10; page++) {
    const r = await ghl(env, 'GET', `/opportunities/search?location_id=${c.location}&pipeline_id=${c.pipeline}&limit=100&page=${page}`);
    const ops = r.opportunities || [];
    for (const o of ops) {
      const x = byGo[o.id];
      if (!x || !back[o.pipelineStageId] || x.gs === o.pipelineStageId) continue;
      const to = back[o.pipelineStageId];
      await env.DB.batch([
        env.DB.prepare('UPDATE leads SET st=?, gs=?, upd=? WHERE id=?').bind(to, o.pipelineStageId, Date.now(), x.id),
        env.DB.prepare('INSERT INTO ev (lead,ts,who,a,p) VALUES (?,?,?,?,?)').bind(x.id, Date.now(), 'GoHighLevel', 'Moved to "' + to + '" in GoHighLevel', x.st || STAGES[0]),
      ]);
    }
    if (ops.length < 100) break;
  }
}

// ---------- Jobs the cron runs ----------
async function jobs(env) {
  const { results } = await env.DB.prepare('SELECT * FROM jobs WHERE done=0 ORDER BY id LIMIT 3').all();
  for (const j of results) {
    let out = 'ok';
    try {
      if (j.kind === 'import') {
        // The list arrives locked (AES-GCM); only this Worker holds the key.
        const r = await fetch(j.arg, { cf: { cacheTtl: 0 } }); if (!r.ok) throw new Error('fetch ' + r.status);
        const raw = b64((await r.text()).trim()), key = await crypto.subtle.importKey('raw', b64(env.DATA_KEY), 'AES-GCM', false, ['decrypt']);
        const rows = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))));
        const st = env.DB.prepare('INSERT INTO leads (id,g,n,k,t,a,p,u,e,rt,rv,mi,w,f,src,st,upd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET g=excluded.g,n=excluded.n,k=excluded.k,t=excluded.t,a=excluded.a,p=excluded.p,u=excluded.u,rt=excluded.rt,rv=excluded.rv,mi=excluded.mi,w=excluded.w,f=excluded.f,src=excluded.src');
        for (let i = 0; i < rows.length; i += 50) await env.DB.batch(rows.slice(i, i + 50).map(x => st.bind(x.id, x.g, x.n, x.k, x.t, x.a, x.p, x.u || '', '', x.rt, x.rv, x.mi, x.w, x.f, x.src, STAGES[0], Date.now())));
        out = 'imported ' + rows.length;
      } else if (j.kind === 'ghl-load') {
        // arg: {"tiers":["A","B"],"limit":25}. Loads shops that aren't in GoHighLevel yet, a batch per run.
        if (!env.GHL_TOKEN) throw new Error('no GoHighLevel key yet');
        const a = JSON.parse(j.arg || '{}'), tiers = a.tiers || ['A'], lim = Math.min(a.limit || 25, 40);
        const { results: L } = await env.DB.prepare(`SELECT * FROM leads WHERE (go IS NULL OR go='') AND g IN (${tiers.map(() => '?').join(',')}) ORDER BY id LIMIT ?`).bind(...tiers, lim).all();
        let n = 0; for (const x of L) { await ensure(env, x); n++; }
        const left = await env.DB.prepare(`SELECT COUNT(*) c FROM leads WHERE (go IS NULL OR go='') AND g IN (${tiers.map(() => '?').join(',')})`).bind(...tiers).first();
        out = 'loaded ' + n + ', left ' + left.c;
        if (left.c > 0 && n > 0) await env.DB.prepare('INSERT INTO jobs (kind,arg,ts) VALUES (?,?,?)').bind('ghl-load', j.arg, Date.now()).run();
      } else out = 'unknown job';
    } catch (e) { out = 'error: ' + String(e).slice(0, 400); }
    await env.DB.prepare('UPDATE jobs SET done=1, out=?, ts=? WHERE id=?').bind(out, Date.now(), j.id).run();
  }
}

// ---------- Mail and email (step 1) ----------
// piece      {id, pid, st, subj, body, why}  st: "sent" (an email, after "Did it send?" Yes), "ready" (a postcard or letter, approved for the next mail drop), "notsent" (with a reason)
// pieceback  {id, pid}                       takes back the last record for that piece on that shop
// draft      {id, pid, subj, body}           keeps edits not sent yet; empty subj and body throws the draft away (Back to original)
// words      {id, pid, sid?}                 the exact words of a record
// dnc        {id, on, why}                   do not contact: stops every piece on the shop
const PST = { sent: 'sent', ready: 'put in the next mail drop', notsent: 'not sent' };
async function pieceAct(b, me, env, ctx) {
  const id = String(b.id || ''), pid = String(b.pid || ''), now = Date.now();
  const x = await env.DB.prepare('SELECT id,n,e,a,wk,st FROM leads WHERE id=?').bind(id).first(); if (!x) return J({ error: 'no such shop' }, 404);
  if (b.op === 'dnc') {
    const on = b.on ? 1 : 0, why = String(b.why || '').trim().slice(0, 300);
    await env.DB.prepare('INSERT INTO flags (lead,dnc,who,ts,why) VALUES (?,?,?,?,?) ON CONFLICT(lead) DO UPDATE SET dnc=excluded.dnc, who=excluded.who, ts=excluded.ts, why=excluded.why').bind(id, on, me, now, why).run();
    ctx.waitUntil(push(env, id, on ? me + ' marked this shop DO NOT CONTACT. Nothing more goes to them.' + (why ? ' Why: ' + why : '') : me + ' took off Do not contact.'));
    return J(await all(env, me));
  }
  const pc = await env.DB.prepare('SELECT pid,kind,name FROM pieces WHERE pid=? ORDER BY sender LIMIT 1').bind(pid).first(); if (!pc) return J({ error: 'no such piece' }, 404);
  if (b.op === 'draft') {
    const subj = String(b.subj || '').slice(0, 300), body = String(b.body || '').slice(0, 20000);
    if (!subj.trim() && !body.trim()) await env.DB.prepare('DELETE FROM drafts WHERE lead=? AND pid=?').bind(id, pid).run();
    else await env.DB.prepare('INSERT INTO drafts (lead,pid,who,ts,subj,body) VALUES (?,?,?,?,?,?) ON CONFLICT(lead,pid) DO UPDATE SET who=excluded.who, ts=excluded.ts, subj=excluded.subj, body=excluded.body').bind(id, pid, me, now, subj, body).run();
    return J({ ok: 1 });
  }
  if (b.op === 'words') {
    const r = b.sid ? await env.DB.prepare('SELECT * FROM sends WHERE id=? AND lead=? AND pid=?').bind(Number(b.sid), id, pid).first()
                    : await env.DB.prepare("SELECT * FROM sends WHERE lead=? AND pid=? AND st<>'taken back' ORDER BY id DESC LIMIT 1").bind(id, pid).first();
    return r ? J({ ok: 1, rec: { id: r.id, by: r.who, ts: r.ts, st: r.st, to: r.dest, subj: r.subj, body: r.body, why: r.why, mode: r.mode } }) : J({ error: 'none' }, 404);
  }
  const lastRec = await env.DB.prepare("SELECT id,st,who,ts,subj,body FROM sends WHERE lead=? AND pid=? AND st<>'taken back' ORDER BY id DESC LIMIT 1").bind(id, pid).first();
  if (b.op === 'pieceback') {
    if (!lastRec) return J({ error: 'nothing to take back' }, 400);
    const q = [env.DB.prepare("UPDATE sends SET st='taken back', why=? WHERE id=?").bind(me + ' took back "' + (PST[lastRec.st] || lastRec.st) + '" on ' + new Date(now).toISOString().slice(0, 10) + (lastRec.why ? '. Was: ' + lastRec.why : ''), lastRec.id)];
    if (lastRec.st !== 'notsent' && (lastRec.body || '').trim()) q.push(env.DB.prepare('INSERT INTO drafts (lead,pid,who,ts,subj,body) VALUES (?,?,?,?,?,?) ON CONFLICT(lead,pid) DO UPDATE SET who=excluded.who, ts=excluded.ts, subj=excluded.subj, body=excluded.body').bind(id, pid, lastRec.who, now, lastRec.subj || '', lastRec.body));
    await env.DB.batch(q);
    ctx.waitUntil(push(env, id, me + ' took back "' + pc.name + ' ' + (PST[lastRec.st] || lastRec.st) + '" (the record only).'));
    return J(await all(env, me));
  }
  // op "piece"
  const st = String(b.st || '');
  // Postcards and letters go to every shop in batches; nothing is recorded for them from a shop.
  if (pc.kind !== 'email' || !['sent', 'notsent'].includes(st)) return J({ error: 'Mail goes out in batches, not from a shop.' }, 400);
  const subj = String(b.subj || '').slice(0, 300), body = String(b.body || '').slice(0, 20000), why = String(b.why || '').trim().slice(0, 300);
  if (st === 'notsent' && !why) return J({ error: 'Say why it was not sent.' }, 400);
  if (lastRec && lastRec.st !== 'notsent') return J({ error: lastRec.who + ' already ' + (PST[lastRec.st] || lastRec.st) + ' ' + pc.name + ' for this shop. This one was not recorded.', already: 1 }, 409);
  if (st !== 'notsent') {
    const dnc = await env.DB.prepare('SELECT dnc FROM flags WHERE lead=?').bind(id).first();
    if (dnc && dnc.dnc) return J({ error: 'This shop is marked Do not contact.' }, 409);
    if (STAGES.indexOf(x.st || STAGES[0]) >= STAGES.indexOf('Talked to the owner')) return J({ error: 'The cold pieces have stopped for this shop: it is at "' + x.st + '".' }, 409);
    if (!body.trim()) return J({ error: 'The words are empty.' }, 400);
    if (st === 'sent') {
      if (!(x.e || '').trim()) return J({ error: 'No email address for this shop.' }, 400);
      const mine = await env.DB.prepare('SELECT 1 ok FROM pieces WHERE pid=? AND sender=?').bind(pid, me).first();
      if (!mine) return J({ error: pc.name + ' is not written for ' + me + ' yet.' }, 400);
    }
    if (st === 'ready' && !(x.a || '').trim()) return J({ error: 'No mailing address for this shop.' }, 400);
  }
  const dest = st === 'sent' ? x.e : st === 'ready' ? x.n + ', ' + x.a : '', mode = pc.kind === 'email' ? 'mail app' : 'practice';
  const q = [env.DB.prepare('INSERT INTO sends (lead,pid,who,ts,st,dest,subj,body,why,mode) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, pid, me, now, st, dest, st === 'notsent' ? '' : subj, st === 'notsent' ? '' : body, why, mode)];
  if (st !== 'notsent') q.push(env.DB.prepare('DELETE FROM drafts WHERE lead=? AND pid=?').bind(id, pid));
  // Whoever sends an email to a shop nobody has claimed becomes the one working it.
  q.push(env.DB.prepare('UPDATE leads SET wk=CASE WHEN ? AND (wk IS NULL OR wk=\'\') THEN ? ELSE wk END, upd=? WHERE id=?').bind(st === 'sent' ? 1 : 0, me, now, id));
  try { await env.DB.batch(q); } catch (e) { if (/UNIQUE/i.test(String(e))) return J({ error: pc.name + ' was just recorded for this shop by someone else. This one was not recorded.', already: 1 }, 409); throw e; }
  const line = st === 'sent' ? me + ' sent ' + pc.name + ' by email to ' + dest + '.\n\nSubject: ' + subj + '\n\n' + body
    : st === 'ready' ? me + ' put ' + pc.name + ' in the next mail drop (practice mode: nothing mails yet).\n\n' + body
    : me + ': ' + pc.name + ' not sent. Why: ' + why;
  ctx.waitUntil(push(env, id, line));
  return J(await all(env, me));
}

async function act(b, me, env, ctx) {
  const id = String(b.id || ''), now = Date.now();
  if (b.op === 'add') {
    const n = String(b.n || '').trim().slice(0, 120); if (!n) return J({ error: 'name' }, 400);
    const nid = 'C' + now.toString(36).toUpperCase(), s = v => String(v || '').trim().slice(0, 400);
    await env.DB.prepare('INSERT INTO leads (id,g,n,k,t,a,p,u,e,w,f,src,custom,st,upd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)').bind(nid, ['A', 'B', 'Worth a visit'].includes(b.g) ? b.g : 'Worth a visit', n, s(b.k) || 'Business', s(b.t) || 'Town not set', s(b.a), s(b.p), s(b.u), '', s(b.w) || 'Added by hand.', '', 'Added by ' + me, STAGES[0], now).run();
    return J(await all(env, me));
  }
  if (['piece', 'pieceback', 'draft', 'words', 'dnc'].includes(b.op)) return pieceAct(b, me, env, ctx);
  const x = await env.DB.prepare('SELECT id,st FROM leads WHERE id=?').bind(id).first(); if (!x) return J({ error: 'no such shop' }, 404);
  const st = x.st || STAGES[0];
  if (b.op === 'did') {
    const a = String(b.a || '').slice(0, 120), to = STAGES.includes(b.to) ? b.to : st; if (!a) return J({ error: 'action' }, 400);
    await env.DB.batch([env.DB.prepare('INSERT INTO ev (lead,ts,who,a,p) VALUES (?,?,?,?,?)').bind(id, now, me, a, st), env.DB.prepare('UPDATE leads SET st=?, upd=? WHERE id=?').bind(to, now, id)]);
    ctx.waitUntil(push(env, id, me + ': ' + a));
  } else if (b.op === 'undo') {
    const e = await env.DB.prepare('SELECT id,p FROM ev WHERE lead=? ORDER BY id DESC LIMIT 1').bind(id).first();
    if (e) { await env.DB.batch([env.DB.prepare('DELETE FROM ev WHERE id=?').bind(e.id), env.DB.prepare('UPDATE leads SET st=?, upd=? WHERE id=?').bind(e.p || STAGES[0], now, id)]); ctx.waitUntil(push(env, id, me + ' took back the last step.')); }
  } else if (b.op === 'stage') {
    if (!STAGES.includes(b.to)) return J({ error: 'stage' }, 400);
    await env.DB.prepare('UPDATE leads SET st=?, upd=? WHERE id=?').bind(b.to, now, id).run(); ctx.waitUntil(push(env, id, me + ' set the stage by hand: ' + b.to));
  } else if (b.op === 'note') {
    await env.DB.prepare('UPDATE leads SET note=?, upd=? WHERE id=?').bind(String(b.note || '').slice(0, 20000), now, id).run(); ctx.waitUntil(pushNote(env, id));
    return J({ ok: 1 });
  } else if (b.op === 'email') {
    await env.DB.prepare('UPDATE leads SET e=?, upd=? WHERE id=?').bind(String(b.e || '').trim().slice(0, 200), now, id).run();
  } else if (b.op === 'claim') {
    await env.DB.prepare('UPDATE leads SET wk=?, upd=? WHERE id=?').bind(b.on ? me : '', now, id).run();
  } else return J({ error: 'op' }, 400);
  return J(await all(env, me));
}

// GoHighLevel calls this when something happens there (a sign-up, a booked call, a reply).
async function hook(u, req, env) {
  if (!env.HOOK_KEY || u.searchParams.get('key') !== env.HOOK_KEY) return J({ error: 'key' }, 403);
  let b = {}; try { b = await req.json(); } catch (e) {}
  return J(await record(env, b, 'GoHighLevel'));
}
// Put a sign-up or a booking on the shared list (new shop if we don't have it), with a line in its history.
async function record(env, b, who) {
  const d = String(b.phone || '').replace(/\D/g, '').slice(-10), what = String(b.event || b.what || 'Something happened in GoHighLevel').slice(0, 200), now = Date.now();
  let x = b.contact_id ? await env.DB.prepare('SELECT id,st FROM leads WHERE gc=?').bind(String(b.contact_id)).first() : null;
  if (!x && d.length === 10) x = await env.DB.prepare("SELECT id,st FROM leads WHERE substr(replace(replace(replace(replace(replace(replace(p,'-',''),'(',''),')',''),' ',''),'.',''),'+',''),-10)=?").bind(d).first();
  if (!x) {
    const id = 'G' + now.toString(36).toUpperCase(), n = String(b.business || b.name || 'New sign-up').slice(0, 120);
    await env.DB.prepare('INSERT INTO leads (id,g,n,k,t,a,p,u,e,w,f,src,custom,st,gc,upd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)').bind(id, 'Signed up', n, String(b.kind || 'Business').slice(0, 80), String(b.town || '').slice(0, 80), '', d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : '', '', String(b.email || '').slice(0, 200), 'Came to us: ' + what, String(b.job || '').slice(0, 600), 'GoHighLevel', STAGES.includes(b.stage) ? b.stage : STAGES[0], b.contact_id ? String(b.contact_id) : null, now).run();
    x = { id, st: STAGES[0] };
  }
  const to = STAGES.includes(b.stage) ? b.stage : (x.st || STAGES[0]);
  await env.DB.batch([env.DB.prepare('INSERT INTO ev (lead,ts,who,a,p) VALUES (?,?,?,?,?)').bind(x.id, now, who, what, x.st || STAGES[0]), env.DB.prepare('UPDATE leads SET st=?, upd=? WHERE id=?').bind(to, now, x.id)]);
  return { ok: 1, id: x.id };
}

// ---------- The free 15-minute call: Jimmy's real times, and booking them (public, from /free15/start/) ----------
const FREE15 = 'sUuL0HSvAbB0kwLJhhtL', TZ = 'America/New_York';
async function slots(env) {
  if (!env.GHL_TOKEN) return J({ days: [] });
  const now = Date.now(), r = await ghl(env, 'GET', `/calendars/${FREE15}/free-slots?startDate=${now}&endDate=${now + 9 * 864e5}&timezone=${encodeURIComponent(TZ)}`);
  const days = Object.keys(r).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && (r[k].slots || []).length).sort().map(k => ({ date: k, slots: r[k].slots }));
  return new Response(JSON.stringify({ days }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
async function book(req, env) {
  let b = {}; try { b = await req.json(); } catch (e) {}
  const slot = String(b.slot || ''), ph0 = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 16), ph = /^\d{10}$/.test(ph0) ? '+1' + ph0 : ph0, nm = String(b.name || '').trim().slice(0, 120);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[-+]\d{2}:\d{2}$/.test(slot) || ph.replace(/\D/g, '').length < 10 || !nm) return J({ error: 'missing' }, 400);
  const parts = nm.split(/\s+/), loc = cfg(env).location, out = { ok: 0 };
  if (env.GHL_TOKEN) {
    const c = await ghl(env, 'POST', '/contacts/upsert', { locationId: loc, firstName: parts[0], lastName: parts.slice(1).join(' ') || undefined, phone: ph, email: String(b.email || '').trim() || undefined, source: '2guysandagenie.com free 15' });
    const cid = (c.contact || {}).id; out.contact = cid;
    const start = new Date(slot), end = new Date(start.getTime() + 15 * 6e4);
    const a = await ghl(env, 'POST', '/calendars/events/appointments', { calendarId: FREE15, locationId: loc, contactId: cid, assignedUserId: 'in2AJWryMpawGX9gUhFe', startTime: slot, endTime: end.toISOString(), title: 'Free 15: ' + nm, appointmentStatus: 'confirmed', ignoreFreeSlotValidation: false, toNotify: true });
    out.ok = 1; out.appointment = a.id || (a.appointment || {}).id;
  }
  try { await record(env, { name: nm, business: b.business, phone: ph, email: b.email, job: b.job, contact_id: out.contact, stage: '15 minutes booked', event: 'Booked the free 15 for ' + String(b.when || slot).slice(0, 60) + ' (from the website)' }, 'Website'); } catch (e) {}
  return J(out);
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    try {
      if (u.pathname === '/hooks/ghl-slots' && req.method === 'GET') return slots(env);
      if (u.pathname === '/hooks/ghl-book' && req.method === 'POST') { try { await init(env); } catch (e) {} return book(req, env); }
      await init(env);
      if (u.pathname === '/hooks/ghl' && req.method === 'POST') return hook(u, req, env);
      if (!u.pathname.startsWith('/admin/api/')) return J({ error: 'not found' }, 404);
      const me = await who(req, env); if (!me) return J({ error: 'sign in' }, 401);
      if (u.pathname === '/admin/api/leads' && req.method === 'GET') return J(await all(env, me));
      if (u.pathname === '/admin/api/act' && req.method === 'POST') return act(await req.json(), me, env, ctx);
      return J({ error: 'not found' }, 404);
    } catch (e) { return J({ error: String(e).slice(0, 200) }, 500); }
  },
  async scheduled(ev, env, ctx) { await init(env); await jobs(env); try { await pull(env); } catch (e) {} },
};
