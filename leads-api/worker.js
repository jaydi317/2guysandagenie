// 2 Guys lead portal: the shared record behind /admin/leads/.
// Every route under /admin/api/ sits behind the Admin sign-in (Cloudflare Access); the Worker checks the sign-in token itself too.
// /admin/api/leads   GET   every shop, its stage, who's working it, notes and history
// /admin/api/act     POST  one change: did, undo, stage, note, email, claim, add, grade, area, and for mail and email: piece, pieceback, draft, words, dnc
// /admin/api/money  GET, POST  the Money Board: visits, leads and bookings by source, tracking links, costs, sales
// /admin/api/money/who  GET  where a buyer first came from, by email
// /hooks/ghl         POST  GoHighLevel tells us something happened (needs ?key=)
// /admin/api/clients GET, POST  the client pages: every owner's page and the team's notes (team only)
// /c/api/me          GET   one owner's own page, picked by the email he signed in with (the owner sign-in, a second Access app on /c)
// /c/api/ask         POST  an owner asks a question from his page
// Every few minutes (cron): run queued jobs (import, load into GoHighLevel) and pull stage changes made in GoHighLevel.
// No shop is named in this file. The records live in the D1 database, never in the site's files.

// Grades (Nov 27): A and B are the target, Worth a visit is a door worth walking through, Found, not graded is on the list only so nobody finds it twice,
// Leave and Franchise are looked at and not for us. Only A, B and sign-ups come up on Today.
const GRADES = ['A', 'B', 'Worth a visit', 'Found, not graded', 'Leave', 'Franchise'], HIDDEN = ['Found, not graded', 'Leave', 'Franchise'];
const STAGES = ['Not touched yet', 'Slydial sent', 'Tried, no owner yet', 'Talked to the owner', '15 minutes booked', '15 minutes done', 'Offer made', 'Client', 'Not now'];
const PEOPLE = { 'daegan@maximum-leverage.com': 'Daegan', 'daegansmith@me.com': 'Daegan', 'jimmydavisprivate@gmail.com': 'Jimmy', 'paul@2guysandagenie.com': 'Paul' };
const GHL = 'https://services.leadconnectorhq.com';
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const b64 = x => { x = x.replace(/-/g, '+').replace(/_/g, '/'); x += '='.repeat((4 - x.length % 4) % 4); return Uint8Array.from(atob(x), c => c.charCodeAt(0)); };
let ready = false, certs = null, certsAt = 0;

// The six pieces, in the order an owner gets them (three postcards locked Nov 24, three emails from Draft 6, Nov 23). Only used to fill an empty database.
// Mail pieces have one version (sender "Any"). Each email has a version per sender; only Paul's is written so far.
// [First Name]: with no owner name on file, the greeting line is left off and the piece just starts.
const RETIRED = ['postcard', 'letter1', 'letter2', 'letter3'];
const SEED = [
{ pid: 'postcard1', sender: 'Any', ord: 1, kind: 'mail', name: 'Postcard 1', tip: 'The QR code goes on the card when it is printed. Nothing for you to do about it.', body:
`FRONT

2GuysAndAGenie.com

FACT: Nobody Wants To Be Told Their Baby's Ugly.

But It Might Be What You Need To Hear Most. Especially Right Now...

BACK

58% of small businesses say they now use AI.

But in Indiana, only 22% of businesses are actually using it.
(U.S. Chamber of Commerce, 2025 · Indiana: U.S. Census Bureau, Nov 2026)

That's good news. Start now and you're ahead of the game. Ever heard of first-mover advantage?

I've seen what getting ahead can do when you move fast.

I'm Jimmy. A couple months ago, I told my handyman, Jamon, nobody could find him from the name painted on his van.

So I changed it and put AI to work in his business. In about 60 days, he went from $15,000 a month to $50,000, right here in Fishers. You can too.

Go here now. Let's get started. It's free.

2GuysAndAGenie.com/free15
Or call us: (317) 751-2693 · or scan the code

Jimmy and Paul` },
{ pid: 'email1', sender: 'Paul', ord: 2, kind: 'email', name: 'Email 1', subj: 'Paul Lorkowski, from Fishers', body:
`Hi [First Name],

My name is Paul Lorkowski.

I ran a business here in Hamilton County for years before selling it, so I know what lands on an owner's plate.

Now my partner Jimmy and I help local owners put AI to work in their businesses.

I'm writing to introduce myself before I call or stop by this week.

If there's one job in your business you'd love to get off your plate, I'd like to hear about it.

That's usually the first thing we help with.

You can reply to this email, or call us at (317) 751-2693.

Paul

2GuysAndAGenie.com` },
{ pid: 'postcard2', sender: 'Any', ord: 3, kind: 'mail', name: 'Postcard 2', tip: 'The QR code goes on the card when it is printed. Nothing for you to do about it.', body:
`FRONT

2GuysAndAGenie.com

You're Invited.

Bring Your Phone And Your Curiosity.

The Pizza's Free. One Night In Fishers. One Job Off Your Plate...

BACK

5.6 hours a week back when small business workers use AI.
(business.com small business AI study, 2025)

Close your eyes. It's Friday. You leave at noon instead of 5.

What would you do with that afternoon?

Now picture it every week.

On December 10, let's make it real.

Free pizza for local business owners at Launch Fishers.

Bring the one thing you never want to do again. We'll help you put AI to work on it, on your phone.

Thursday, December 10 · Doors 6:00, done by 9 · 12175 Visionary Way

Save your free spot (and your pizza) here:

2GuysAndAGenie.com/meetup
Or call us: (317) 751-2693 · or scan the code

Jimmy and Paul` },
{ pid: 'email2', sender: 'Paul', ord: 4, kind: 'email', name: 'Email 2', subj: 'an invitation for December 10', body:
`Hi [First Name],

It's Paul Lorkowski again.

Jimmy and I are hosting an evening for local business owners on Thursday, December 10, at Launch Fishers.

It's free, and we're buying the pizza.

We spend about an hour showing what AI can do in a business, then help each owner try it on something of their own.

Doors open at 6:00, and we're done by 9.

I'd like to have you there.

If you'd like to come, reply and I'll save you a seat myself.

Paul

2GuysAndAGenie.com` },
{ pid: 'postcard3', sender: 'Any', ord: 5, kind: 'mail', name: 'Postcard 3', tip: 'The QR code goes on the card when it is printed. Nothing for you to do about it.', body:
`FRONT

2GuysAndAGenie.com

FACT: The Thing That Changes Your Business Is Usually Small.

So Small You've Stopped Noticing It...

BACK

85% of callers who reach your voicemail hang up without leaving a message.
(Quo, 18 million missed calls, 2026)

So your voicemail looks quiet. Like nobody called.

They called. Then they called someone else.

Jamon Jack, a local handyman, had two small things he'd stopped noticing. Calls that went to voicemail. And a van that said TJOAT, for The Jack Of All Trades.

Nobody could find him.

Now he's GottaCallJack.com, and every missed call gets a text back. He's doing three times the business.

What's your one little thing? You probably can't see it. Jamon couldn't. We can.

Let's find it together.

Book your free 15-minute call here:

2GuysAndAGenie.com/free15
Or call us: (317) 751-2693 · or scan the code

Jimmy and Paul` },
{ pid: 'email3', sender: 'Paul', ord: 6, kind: 'email', name: 'Email 3', subj: 'one thing', body:
`Hi [First Name],

Paul Lorkowski here, one more time.

I've sent a couple of notes, so I'll keep this one short.

Jimmy and I started this business after one small change set a local owner's business on a new course.

We'd like the chance to find that one thing for you.

If something in your business comes to mind, reply and tell me what it is.

I'll take it from there.

And if you'd rather I stop writing, just say so.

Paul

2GuysAndAGenie.com` }
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
    // Client pages (Nov 27): one row per owner. emails = who may open his page (comma-separated). data = the whole page as JSON.
    env.DB.prepare('CREATE TABLE IF NOT EXISTS clients (slug TEXT PRIMARY KEY, name TEXT, emails TEXT, data TEXT, upd INTEGER, by TEXT)'),
    // Areas already swept for new shops (Nov 27), so no two Claudes sweep the same place. status: in progress or done.
    env.DB.prepare('CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTOINCREMENT, area TEXT, who TEXT, d TEXT, status TEXT, round TEXT, notes TEXT, ts INTEGER)'),
  ]);
  // The pieces' starting words go in once. After that the database is the master copy, so they can change without a code change.
  // A piece already in the database is never overwritten from here; a new piece or a new sender's version is added.
  // Retired Nov 24: the first postcard and the three letters, replaced by the three locked postcards. Gone only if nothing was ever sent, drafted or approved with them.
  for (const pid of RETIRED) { const used = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM sends WHERE pid=?) + (SELECT COUNT(*) FROM drafts WHERE pid=?) AS n').bind(pid, pid).first(); if (!used || !used.n) await env.DB.prepare('DELETE FROM pieces WHERE pid=?').bind(pid).run(); }
  // The order comes from here, so the emails sit between the postcards.
  await env.DB.batch(SEED.map(p => env.DB.prepare('UPDATE pieces SET ord=? WHERE pid=? AND ord<>?').bind(p.ord, p.pid, p.ord)));
  const have = await env.DB.prepare('SELECT pid, sender FROM pieces').all(), got = new Set(have.results.map(r => r.pid + '|' + r.sender)), add = SEED.filter(p => !got.has(p.pid + '|' + p.sender));
  if (add.length) { const s = env.DB.prepare('INSERT OR IGNORE INTO pieces (pid,sender,ord,kind,name,subj,body,tip,upd) VALUES (?,?,?,?,?,?,?,?,?)'); await env.DB.batch(add.map(p => s.bind(p.pid, p.sender, p.ord, p.kind, p.name, p.subj || '', p.body, p.tip || '', Date.now()))); }
  // What GoHighLevel was last told, so each is only sent when it changes: ga = who it's assigned to (a first name), ge = email, gd = do not contact.
  // gt = how many catch-up tries in a row have failed (it stops at 3, so a shop GoHighLevel keeps refusing isn't retried forever).
  // gf = '1' when a new import changed the shop's details and GoHighLevel hasn't had them yet.
  // gx = whose contact it is there: 'ours' (the portal made it) or 'theirs' (it was there before, a client or a sign-up, and the portal only linked to it).
  for (const c of ['ga TEXT', 'ge TEXT', 'gd TEXT', 'gx TEXT', 'gt INTEGER', 'gf TEXT']) { try { await env.DB.prepare('ALTER TABLE leads ADD COLUMN ' + c).run(); } catch (e) {} }
  ready = true;
}

// Who is signed in, from an Access token for the given sign-in (aud). Returns their email, or null.
async function signedIn(req, env, aud) {
  const t = req.headers.get('Cf-Access-Jwt-Assertion'); if (!t) return null;
  const [h, p, s] = t.split('.'); if (!s) return null;
  let head, pay; try { head = JSON.parse(new TextDecoder().decode(b64(h))); pay = JSON.parse(new TextDecoder().decode(b64(p))); } catch (e) { return null; }
  for (let i = 0; i < 2; i++) {
    if (!certs || Date.now() - certsAt > 3600e3 || i) { const r = await fetch(`https://${env.TEAM}/cdn-cgi/access/certs`); certs = (await r.json()).keys || []; certsAt = Date.now(); }
    const jwk = certs.find(k => k.kid === head.kid); if (!jwk) continue;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(s), new TextEncoder().encode(h + '.' + p));
    if (!ok) return null;
    if (![].concat(pay.aud || []).includes(aud) || (pay.exp || 0) * 1000 < Date.now()) return null;
    // A Claude signs in with its own Access service token: no email, just the token's client id (common_name).
    return String(pay.email || '').toLowerCase() || (pay.common_name ? 'svc:' + pay.common_name : null);
  }
  return null;
}

// SVC (plain setting, JSON): which person each Claude's service token acts for, {"<client id>": "Paul"}. Its taps are saved under that person's name.
function svc(env) { try { return JSON.parse(env.SVC || '{}'); } catch (e) { return {}; } }
async function who(req, env) { const em = await signedIn(req, env, env.AUD); if (!em) return null; if (em.startsWith('svc:')) return svc(env)[em.slice(4)] || null; return PEOPLE[em] || null; }

// ---------- Client pages ----------
// The team reads and writes every page; an owner reads only his own (team-only parts taken out) and can ask a question.
const clean = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const emList = x => String(x || '').toLowerCase().split(/[\s,;]+/).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
function ownerView(d) { d = JSON.parse(JSON.stringify(d || {})); delete d.team; delete d.inbox; d.notes = (d.notes || []).filter(n => n.show); d.items = (d.items || []).filter(i => i.st !== 'Not started'); return d; }
async function clientsAll(env, me) {
  const r = await env.DB.prepare('SELECT slug,name,emails,data,upd,by FROM clients ORDER BY name').all();
  return { me, clients: r.results.map(c => ({ ...c, data: JSON.parse(c.data || '{}') })) };
}
async function clientsAct(b, me, env) {
  const now = Date.now();
  if (b.op === 'add') {
    const name = String(b.name || '').trim().slice(0, 80); let slug = clean(b.slug || name); if (!name || !slug) return J({ error: 'Give the client a name.' }, 400);
    for (let i = 2; await env.DB.prepare('SELECT 1 FROM clients WHERE slug=?').bind(slug).first(); i++) slug = clean(name) + '-' + i;
    const data = { biz: name + ' HQ', who: 'Prepared for ' + name, stage: 0, items: [], need: [], qa: [], meets: [], more: [], notes: [], inbox: [], stats: [], plan: { q: [], b: [], s: [], n: [] }, team: {} };
    await env.DB.prepare('INSERT INTO clients (slug,name,emails,data,upd,by) VALUES (?,?,?,?,?,?)').bind(slug, name, '', JSON.stringify(data), now, me).run();
    return J({ ...(await clientsAll(env, me)), made: slug });
  }
  if (b.op === 'save') {
    const c = await env.DB.prepare('SELECT upd, by, data FROM clients WHERE slug=?').bind(String(b.slug || '')).first(); if (!c) return J({ error: 'No such client.' }, 404);
    if (b.upd && c.upd !== b.upd) {
      // If the only change since was the owner asking a question, keep his question and save ours on top. Otherwise stop, so nobody's work is lost.
      if (c.by !== 'owner') return J({ error: 'Someone else changed this page while you had it open. It has been reloaded; make your change again.', ...(await clientsAll(env, me)) }, 409);
      const have = new Set(((b.data || {}).qa || []).map(q => q.ts)); b.data = b.data || {}; b.data.qa = (b.data.qa || []).concat((JSON.parse(c.data || '{}').qa || []).filter(q => !have.has(q.ts)));
    }
    const data = JSON.stringify(b.data || {}); if (data.length > 400000) return J({ error: 'Too big' }, 400);
    await env.DB.prepare('UPDATE clients SET name=?, emails=?, data=?, upd=?, by=? WHERE slug=?').bind(String(b.name || '').slice(0, 80), emList(b.emails).join(','), data, now, me, b.slug).run();
    return J(await clientsAll(env, me));
  }
  return J({ error: 'op' }, 400);
}
// An owner's own page: the client whose email list has his sign-in email. The team can open any page here as a preview (?c=slug).
async function ownerFind(req, env, u) {
  const em = await signedIn(req, env, env.CAUD); if (!em) return { err: J({ error: 'sign in' }, 401) };
  const want = clean(u.searchParams.get('c'));
  if (PEOPLE[em] && want) { const c = await env.DB.prepare('SELECT * FROM clients WHERE slug=?').bind(want).first(); return c ? { c, em, team: true } : { err: J({ error: 'none' }, 404) }; }
  const r = await env.DB.prepare("SELECT * FROM clients WHERE ',' || emails || ',' LIKE ?").bind('%,' + em + ',%').all();
  if (!r.results.length) return { err: J({ error: 'none', email: em }, 404) };
  return { c: r.results[0], em };
}
async function ownerAsk(req, env, u) {
  const f = await ownerFind(req, env, u); if (f.err) return f.err;
  const q = String((await req.json()).q || '').trim().slice(0, 2000); if (!q) return J({ error: 'Type your question first.' }, 400);
  const d = JSON.parse(f.c.data || '{}'); (d.qa = d.qa || []).push({ q, by: f.em, ts: Date.now() });
  await env.DB.prepare("UPDATE clients SET data=?, upd=?, by='owner' WHERE slug=?").bind(JSON.stringify(d), Date.now(), f.c.slug).run();
  return J({ name: f.c.name, data: ownerView(d) });
}

async function all(env, me) {
  const [L, E, P, S, D, F, A] = await env.DB.batch([
    env.DB.prepare('SELECT id,g,n,k,t,a,p,u,e,rt,rv,mi,w,f,src,custom,st,wk,note,gc FROM leads ORDER BY id'),
    env.DB.prepare('SELECT lead,ts,who,a,p FROM ev ORDER BY id'),
    env.DB.prepare('SELECT pid,sender,ord,kind,name,subj,body,tip FROM pieces ORDER BY ord, sender'),
    env.DB.prepare("SELECT id,lead,pid,who,ts,st,dest,why,mode FROM sends WHERE st<>'taken back' ORDER BY id"),
    env.DB.prepare('SELECT lead,pid,who,ts,subj,body FROM drafts'),
    env.DB.prepare('SELECT lead,dnc,who,ts,why FROM flags WHERE dnc=1'),
    env.DB.prepare('SELECT id,area,who,d,status,round,notes FROM areas ORDER BY id'),
  ]);
  const H = {}; for (const e of E.results) (H[e.lead] = H[e.lead] || []).push({ ts: e.ts, by: e.who, a: e.a, p: e.p });
  // Per shop: ps = every mail or email record (the words themselves come from op "words"), dr = drafts by piece, dnc = do not contact.
  const PS = {}, DR = {}, DN = {};
  for (const s of S.results) (PS[s.lead] = PS[s.lead] || []).push({ id: s.id, pid: s.pid, by: s.who, ts: s.ts, st: s.st, to: s.dest, why: s.why, mode: s.mode });
  for (const d of D.results) (DR[d.lead] = DR[d.lead] || {})[d.pid] = { by: d.who, ts: d.ts, subj: d.subj, body: d.body };
  for (const f of F.results) DN[f.lead] = { by: f.who, ts: f.ts, why: f.why };
  return { me, ghl: !!env.GHL_TOKEN, grades: GRADES, areas: A.results, pieces: P.results, leads: L.results.map(x => ({ ...x, st: x.st || STAGES[0], h: H[x.id] || [], ps: PS[x.id] || [], dr: DR[x.id] || {}, dnc: DN[x.id] || null })) };
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
      gc = ex.id; x.gx = 'theirs';
      await ghl(env, 'PUT', '/contacts/' + gc, { customFields: body.customFields });
      await ghl(env, 'POST', '/contacts/' + gc + '/tags', { tags: body.tags });
    } else {
      const r = await ghl(env, 'POST', '/contacts/', body);
      gc = (r.contact || {}).id; if (!gc) throw new Error('no contact id'); x.gx = 'ours';
    }
  }
  const stage = c.stages[x.st || STAGES[0]];
  // gs (the stage GoHighLevel has) is only written here when the deal card is made. A stage change is written after GoHighLevel takes it,
  // so a refused change can't make the next check-back move the shop backwards.
  let made = false;
  if (!go) {
    const r = await ghl(env, 'POST', '/opportunities/', { locationId: c.location, pipelineId: c.pipeline, pipelineStageId: stage, name: x.n, status: status(x.st), contactId: gc });
    go = (r.opportunity || {}).id; made = !!go;
    if (go) {
      // Two sends at once could both make a card: only the first one written is kept.
      await env.DB.prepare("UPDATE leads SET go=? WHERE id=? AND COALESCE(go,'')=''").bind(go, x.id).run();
      const y = await env.DB.prepare('SELECT go FROM leads WHERE id=?').bind(x.id).first();
      if (y && y.go && y.go !== go) { try { await ghl(env, 'DELETE', '/opportunities/' + go); } catch (e) {} go = y.go; made = false; }
    }
  }
  await env.DB.prepare('UPDATE leads SET gc=?, go=?, gs=CASE WHEN ? THEN ? ELSE gs END, gx=COALESCE(?, gx) WHERE id=?').bind(gc, go || null, made ? 1 : 0, stage, x.gx || null, x.id).run();
  return { gc, go };
}
// Everything the portal knows about a shop also goes onto its GoHighLevel contact, so GoHighLevel can carry the work if the site is down:
// the stage (deal card), who is working it (assigned to, on the contact and the deal), its email, Do not contact (a tag),
// and every step as a note. Returns 'ok', 'off' (no GoHighLevel key), or the first thing GoHighLevel refused.
async function push(env, id, line) {
  if (!env.GHL_TOKEN) return 'off';
  const bad = []; let mode = 'ok';
  const fail = async e => { bad.push(String(e).slice(0, 300)); try { await env.DB.prepare('INSERT INTO jobs (kind,arg,done,out,ts) VALUES (?,?,1,?,?)').bind('ghl-error', id, String(e).slice(0, 400), Date.now()).run(); } catch (e2) {} };
  try {
    const x = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first(); if (!x) return 'off';
    // Shops kept only on file don't go into GoHighLevel until someone grades them A or B (or they sign up).
    if (!x.gc && HIDDEN.includes(x.g)) return 'off';
    const c = cfg(env), had = x.go, { gc, go } = await ensure(env, x), stage = c.stages[x.st || STAGES[0]];
    if (go && had && x.gs !== stage) { try { await ghl(env, 'PUT', '/opportunities/' + go, { pipelineStageId: stage, status: status(x.st) }); await env.DB.prepare('UPDATE leads SET gs=? WHERE id=?').bind(stage, id).run(); } catch (e) { await fail(e); } }
    // Whose contact is it? Shops loaded before this check have no gx yet: look once.
    let gx = x.gx;
    if (!gx) { try { const k = (await ghl(env, 'GET', '/contacts/' + gc)).contact || {}; gx = k.source === 'Local Business Database' ? 'ours' : 'theirs'; await env.DB.prepare('UPDATE leads SET gx=? WHERE id=?').bind(gx, id).run(); } catch (e) { await fail(e); } }
    // Re-read right before sending, so a take and a let-go tapped fast both land in the right order.
    const y = await env.DB.prepare('SELECT wk,e,ga,ge FROM leads WHERE id=?').bind(id).first() || x;
    const wk = y.wk || '', uid = ((c.users || {})[wk]) || '', em = (y.e || '').trim();
    if (gx === 'theirs') {
      // A contact that was in GoHighLevel before the portal (a client, a sign-up) keeps its own owner and email. A note says what changed instead.
      if (wk !== (y.ga || '') || em !== (y.ge || '').replace(/^!/, '')) {
        try {
          await ghl(env, 'POST', '/contacts/' + gc + '/notes', { body: 'Lead portal: ' + (wk ? wk + ' is working this shop.' : 'Nobody is working this shop.') + (em ? ' Email on file: ' + em + '.' : '') + ' (This contact was here before the portal, so its owner and email were left as they are.)' });
          await env.DB.prepare('UPDATE leads SET ga=?, ge=? WHERE id=?').bind(wk, em, id).run();
        } catch (e) { await fail(e); }
      }
    } else if (gx === 'ours') {
      if (wk !== (y.ga || '')) {
        if (wk && !uid) await fail('No GoHighLevel user is set up for ' + wk + ', so the shop is not assigned there.');
        else {
          try {
            await ghl(env, 'PUT', '/contacts/' + gc, { assignedTo: uid || null });
            if (go) await ghl(env, 'PUT', '/opportunities/' + go, { assignedTo: uid || null });
            await env.DB.prepare('UPDATE leads SET ga=? WHERE id=? AND COALESCE(wk,\'\')=?').bind(wk, id, wk).run();
          } catch (e) { await fail(e); }
        }
      }
      // ge is the email GoHighLevel last took, or "!" + the email it refused, so a refused one isn't tried again on every tap.
      if (em !== (y.ge || '') && '!' + em !== (y.ge || '')) {
        try { await ghl(env, 'PUT', '/contacts/' + gc, { email: em || null }); await env.DB.prepare('UPDATE leads SET ge=? WHERE id=?').bind(em, id).run(); }
        catch (e) {
          const dup = em && /duplicat|already|exist/i.test(String(e));
          if (dup) await env.DB.prepare('UPDATE leads SET ge=? WHERE id=?').bind('!' + em, id).run();
          await fail(dup ? 'Another GoHighLevel contact already has ' + em + '. ' + e : e);
        }
      }
    }
    // Details changed by a new import: our own fields on any contact; name, address and website only on contacts the portal made.
    if (x.gf === '1' && gx) {
      try {
        const m = /^(.*?),\s*([^,]+),\s*IN\s*(\d{5})?/.exec(x.a || '') || [];
        const body = { customFields: [[c.f.tier, x.g || ''], [c.f.kind, x.k || ''], [c.f.found, x.f || ''], [c.f.why, x.w || '']].map(([fid, v]) => ({ id: fid, fieldValue: v, field_value: v })) };
        if (gx === 'ours') Object.assign(body, { firstName: x.n, companyName: x.n, address1: m[1] || x.a || undefined, city: m[2] || x.t || undefined, postalCode: m[3] || undefined, website: x.u || undefined });
        await ghl(env, 'PUT', '/contacts/' + gc, body);
        await env.DB.prepare("UPDATE leads SET gf='' WHERE id=?").bind(id).run();
      } catch (e) { await fail(e); }
    }
    const f = await env.DB.prepare('SELECT dnc FROM flags WHERE lead=?').bind(id).first(), dn = f && f.dnc ? '1' : '';
    if (f && dn !== (x.gd || '')) {
      try { await ghl(env, dn ? 'POST' : 'DELETE', '/contacts/' + gc + '/tags', { tags: ['do not contact'] }); await env.DB.prepare('UPDATE leads SET gd=? WHERE id=?').bind(dn, id).run(); } catch (e) { await fail(e); }
    }
    if (line) { try { await ghl(env, 'POST', '/contacts/' + gc + '/notes', { body: line }); } catch (e) { await fail(e); } }
    if (gx === 'theirs') mode = 'theirs';
  } catch (e) { await fail(e); }
  try { await env.DB.prepare(bad.length ? 'UPDATE leads SET gt=CAST(COALESCE(gt,0) AS INTEGER)+1 WHERE id=?' : 'UPDATE leads SET gt=0 WHERE id=?').bind(id).run(); } catch (e) {}
  return bad.length ? bad[0] : mode;
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
// Every run: catch GoHighLevel up on shops whose owner, email or Do not contact it hasn't taken yet (a missed or failed send).
// 5 a run, fewest failed tries first, then most recently changed. After 3 failed tries in a row a shop is left alone until someone taps it again.
// A refused email ("!" in ge) isn't retried until the email changes. A website sign-up with no deal card gets one here.
async function catchUp(env) {
  if (!env.GHL_TOKEN) return;
  const { results: L } = await env.DB.prepare("SELECT l.id FROM leads l LEFT JOIN flags f ON f.lead=l.id WHERE l.gc IS NOT NULL AND CAST(COALESCE(l.gt,0) AS INTEGER)<3 AND (COALESCE(l.go,'')='' OR COALESCE(l.wk,'')<>COALESCE(l.ga,'') OR (TRIM(COALESCE(l.e,''), ' '||char(9,10,13))<>COALESCE(l.ge,'') AND '!' || TRIM(COALESCE(l.e,''), ' '||char(9,10,13))<>COALESCE(l.ge,'')) OR COALESCE(l.gf,'')='1' OR (f.lead IS NOT NULL AND (CASE WHEN f.dnc THEN '1' ELSE '' END)<>COALESCE(l.gd,''))) ORDER BY CAST(COALESCE(l.gt,0) AS INTEGER), l.upd DESC LIMIT 5").all();
  for (const x of L) await push(env, x.id, null);
}
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
        const st = env.DB.prepare(`INSERT INTO leads (id,g,n,k,t,a,p,u,e,rt,rv,mi,w,f,src,st,upd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET gf=CASE WHEN leads.g IS NOT excluded.g OR leads.n IS NOT excluded.n OR leads.k IS NOT excluded.k OR leads.t IS NOT excluded.t OR leads.a IS NOT excluded.a OR leads.u IS NOT excluded.u OR leads.w IS NOT excluded.w OR leads.f IS NOT excluded.f THEN '1' ELSE leads.gf END,gt=CASE WHEN leads.g IS NOT excluded.g OR leads.n IS NOT excluded.n OR leads.k IS NOT excluded.k OR leads.t IS NOT excluded.t OR leads.a IS NOT excluded.a OR leads.u IS NOT excluded.u OR leads.w IS NOT excluded.w OR leads.f IS NOT excluded.f THEN 0 ELSE leads.gt END,g=excluded.g,n=excluded.n,k=excluded.k,t=excluded.t,a=excluded.a,p=excluded.p,u=excluded.u,rt=excluded.rt,rv=excluded.rv,mi=excluded.mi,w=excluded.w,f=excluded.f,src=excluded.src`);
        for (let i = 0; i < rows.length; i += 50) await env.DB.batch(rows.slice(i, i + 50).map(x => st.bind(x.id, x.g, x.n, x.k, x.t, x.a, x.p, x.u || '', '', x.rt, x.rv, x.mi, x.w, x.f, x.src, STAGES[0], Date.now())));
        out = 'imported ' + rows.length;
        // New shops go into GoHighLevel too (a batch per run); changed ones are caught up by catchUp.
        if (env.GHL_TOKEN) await env.DB.prepare('INSERT INTO jobs (kind,arg,ts) VALUES (?,?,?)').bind('ghl-load', JSON.stringify({ tiers: [...new Set(rows.map(x => x.g))], limit: 25 }), Date.now()).run();
      } else if (j.kind === 'ghl-load') {
        // arg: {"tiers":["A","B"],"limit":25}. Loads shops that aren't in GoHighLevel yet, a batch per run.
        if (!env.GHL_TOKEN) throw new Error('no GoHighLevel key yet');
        const a = JSON.parse(j.arg || '{}'), tiers = a.tiers || ['A'], lim = Math.min(a.limit || 25, 40);
        const { results: L } = await env.DB.prepare(`SELECT * FROM leads WHERE (go IS NULL OR go='') AND CAST(COALESCE(gt,0) AS INTEGER)<3 AND g IN (${tiers.map(() => '?').join(',')}) ORDER BY id LIMIT ?`).bind(...tiers, lim).all();
        let n = 0; for (const x of L) {
          try { await ensure(env, x); n++; }
          catch (e) { await env.DB.batch([env.DB.prepare('INSERT INTO jobs (kind,arg,done,out,ts) VALUES (?,?,1,?,?)').bind('ghl-error', x.id, String(e).slice(0, 400), Date.now()), env.DB.prepare('UPDATE leads SET gt=CAST(COALESCE(gt,0) AS INTEGER)+1 WHERE id=?').bind(x.id)]); }
        }
        const left = await env.DB.prepare(`SELECT COUNT(*) c FROM leads WHERE (go IS NULL OR go='') AND CAST(COALESCE(gt,0) AS INTEGER)<3 AND g IN (${tiers.map(() => '?').join(',')})`).bind(...tiers).first();
        out = 'loaded ' + n + ', left ' + left.c;
        if (left.c > 0 && n > 0) await env.DB.prepare('INSERT INTO jobs (kind,arg,ts) VALUES (?,?,?)').bind('ghl-load', j.arg, Date.now()).run();
      } else out = 'unknown job';
    } catch (e) { out = 'error: ' + String(e).slice(0, 400); }
    await env.DB.prepare('UPDATE jobs SET done=1, out=?, ts=? WHERE id=?').bind(out, Date.now(), j.id).run();
  }
}

// ---------- Mail and email (step 1) ----------
// piece      {id, pid, st, subj, body, why}  st: "sent" (an email, after "Did it send?" Yes), "ready" (a postcard, approved for the next mail drop), "notsent" (with a reason)
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
    const g = await push(env, id, on ? me + ' marked this shop DO NOT CONTACT. Nothing more goes to them.' + (why ? ' Why: ' + why : '') : me + ' took off Do not contact.');
    return J({ ...(await all(env, me)), ghlr: g });
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
  // Postcards go to every shop in batches; nothing is recorded for them from a shop.
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
      // No version for this sender yet: the page starts them from Paul's words and won't send while it still says Paul.
      if (me !== 'Paul' && /Paul Lorkowski|^\s*Paul\s*$/m.test(subj + '\n' + body)) return J({ error: 'This still says it\'s from Paul. Change it to come from you first.' }, 400);
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
    // Already on the list? Same phone, or the same name in the same town. Then nothing is added and the shop already there is named.
    const d = String(b.p || '').replace(/\D/g, '').slice(-10), nm = x => String(x || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(llc|inc|co|corp|company|the|pc|llp)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!b.force) {
      const same = (await env.DB.prepare('SELECT id,n,t,p,g,src FROM leads').all()).results.find(y => (d.length === 10 && String(y.p || '').replace(/\D/g, '').slice(-10) === d) || (nm(y.n) === nm(n) && String(y.t || 'Town not set').toLowerCase() === (s(b.t) || 'Town not set').toLowerCase()));
      if (same) return J({ ...(await all(env, me)), dup: same, error: 'Already on the list: ' + same.n + (same.t ? ' (' + same.t + ')' : '') + ', grade ' + (same.g || '?') + '. Nothing was added. If it is a different shop, tap Save It Anyway.' }, 409);
    }
    await env.DB.prepare('INSERT INTO leads (id,g,n,k,t,a,p,u,e,w,f,src,custom,st,upd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)').bind(nid, GRADES.includes(b.g) ? b.g : 'Worth a visit', n, s(b.k) || 'Business', s(b.t) || 'Town not set', s(b.a), s(b.p), s(b.u), '', s(b.w) || 'Added by hand.', '', 'Added by ' + me, STAGES[0], now).run();
    ctx.waitUntil(push(env, nid, me + ' added this shop to the lead portal by hand.'));
    return J(await all(env, me));
  }
  if (['piece', 'pieceback', 'draft', 'words', 'dnc'].includes(b.op)) return pieceAct(b, me, env, ctx);
  if (b.op === 'area') {
    // Add an area before sweeping it ({area, round, notes}), or close it ({aid, status, notes}).
    if (b.aid) await env.DB.prepare('UPDATE areas SET status=?, notes=COALESCE(?, notes), ts=? WHERE id=?').bind(String(b.status || 'done').slice(0, 40), b.notes == null ? null : String(b.notes).slice(0, 600), now, Number(b.aid)).run();
    else { const area = String(b.area || '').trim().slice(0, 200); if (!area) return J({ error: 'Name the area.' }, 400);
      await env.DB.prepare('INSERT INTO areas (area,who,d,status,round,notes,ts) VALUES (?,?,?,?,?,?,?)').bind(area, me, new Date(now).toISOString().slice(0, 10), String(b.status || 'in progress').slice(0, 40), String(b.round || '').slice(0, 80), String(b.notes || '').slice(0, 600), now).run(); }
    return J(await all(env, me));
  }
  if (b.op === 'grade') {
    // Change a shop's grade after it's saved, with the reason. Its "why" line gets the reason on top; GoHighLevel's tier field follows.
    const g = String(b.g || ''); if (!GRADES.includes(g)) return J({ error: 'grade' }, 400);
    const y = await env.DB.prepare('SELECT g,w,st,gc FROM leads WHERE id=?').bind(id).first(); if (!y) return J({ error: 'no such shop' }, 404);
    if (y.g === 'Signed up') return J({ error: 'This one signed up on its own, so it has no grade to change.' }, 400);
    const why = String(b.why || '').trim().slice(0, 1200), line = 'Grade ' + (y.g || '?') + ' to ' + g + (why ? ': ' + why : '');
    // Not a step in the shop's history (that counts as reaching the owner): the old grade and reason stay under "Earlier" in the why line.
    await env.DB.prepare("UPDATE leads SET g=?, w=?, f=CASE WHEN ? <> '' THEN ? ELSE f END, gf='1', gt=0, upd=? WHERE id=?").bind(g, me + ', ' + new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Indiana/Indianapolis' }) + ': ' + (why || 'grade changed') + (y.w ? '\n\nEarlier (' + (y.g || '?') + '): ' + y.w : ''), String(b.f || ''), String(b.f || '').slice(0, 2000), now, id).run();
    // Only shops that are, or now become, worth working go into GoHighLevel.
    ctx.waitUntil(push(env, id, me + ': ' + line));
    return J(await all(env, me));
  }
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
    const e = String(b.e || '').trim().slice(0, 200);
    await env.DB.prepare('UPDATE leads SET e=?, upd=?, gt=0 WHERE id=?').bind(e, now, id).run();
    const g = await push(env, id, e ? me + ' saved this shop\'s email: ' + e : me + ' took this shop\'s email off.');
    // Saved twice fast, the second save finds the refusal already recorded: still say so.
    const gx = g === 'ok' && e ? await env.DB.prepare('SELECT ge FROM leads WHERE id=?').bind(id).first() : null;
    if (gx && gx.ge === '!' + e) return J({ ...(await all(env, me)), ghlr: 'Another GoHighLevel contact already has ' + e + '.' });
    return J({ ...(await all(env, me)), ghlr: g });
  } else if (b.op === 'claim') {
    if (b.free) {
      // From the list's Take button: only a shop nobody is working (or already yours).
      const r = await env.DB.prepare("UPDATE leads SET wk=?, upd=?, gt=0 WHERE id=? AND COALESCE(wk,'') IN ('', ?)").bind(me, now, id, me).run();
      const y = await env.DB.prepare('SELECT wk FROM leads WHERE id=?').bind(id).first();
      if (!y || y.wk !== me) return J({ ...(await all(env, me)), gone: (y && y.wk) || 'someone' });
    } else await env.DB.prepare('UPDATE leads SET wk=?, upd=?, gt=0 WHERE id=?').bind(b.on ? me : '', now, id).run();
    const g = await push(env, id, b.on ? me + ' is working this shop.' : me + ' let this shop go. Anyone can pick it up.');
    return J({ ...(await all(env, me)), ghlr: g });
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
  // A shop kept only on file (Found, not graded, Leave, Franchise) that comes to us on its own is a sign-up now, so it shows on Today.
  await env.DB.prepare("UPDATE leads SET g='Signed up' WHERE id=? AND g IN ('Found, not graded','Leave','Franchise')").bind(x.id).run();
  await env.DB.batch([env.DB.prepare('INSERT INTO ev (lead,ts,who,a,p) VALUES (?,?,?,?,?)').bind(x.id, now, who, what, x.st || STAGES[0]), env.DB.prepare('UPDATE leads SET st=?, upd=? WHERE id=?').bind(to, now, x.id)]);
  // Its deal card goes on the board at the next catch-up (within about 3 minutes), so the person booking never waits on GoHighLevel.
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

// ---------- The Money Board (/admin/money/): where people came from, what it cost, what came back (Nov 25, 2026) ----------
// Rows for the rotating spots (pages home, meetup, free15 in assets/rot.js) are left out; a new rotating page name goes in the NOT IN list in money().
// Visits, leads and bookings come from the scoreboard database (binding STATS, written by assets/src.js through 2g-stats).
// Links, costs and sales are kept there too. Shops we found ourselves count only once they sign up (from this database).
const MK = /^[a-z0-9-]{1,24}$/, KEY = /^[a-z0-9-]{1,24}\|[a-z0-9-]{1,24}(\|[a-z0-9-]{1,24})?$/;
const mclean = x => String(x || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
let mready = false;
async function minit(env) {
  if (mready) return;
  await env.STATS.batch([
    env.STATS.prepare('CREATE TABLE IF NOT EXISTS ev (ts INTEGER, k TEXT, vid TEXT, page TEXT, slot TEXT, v TEXT)'), // the scoreboard's own table, in case it hasn't run yet
    env.STATS.prepare('CREATE TABLE IF NOT EXISTS links (slug TEXT PRIMARY KEY, name TEXT, a TEXT, b TEXT, who TEXT, ts INTEGER, off INTEGER DEFAULT 0)'),
    env.STATS.prepare('CREATE TABLE IF NOT EXISTS costs (id INTEGER PRIMARY KEY AUTOINCREMENT, src TEXT, amt REAL, note TEXT, d INTEGER, who TEXT, ts INTEGER)'),
    env.STATS.prepare('CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, src TEXT, amt REAL, kind TEXT, email TEXT, note TEXT, d INTEGER, who TEXT, ts INTEGER)'),
  ]);
  mready = true;
}
async function money(env, me, u) {
  await minit(env);
  const from = Math.max(0, Number(u.searchParams.get('from')) || 0), test = u.searchParams.get('test') === '1';
  const [E, Lk, C, S] = await env.STATS.batch([
    env.STATS.prepare(`SELECT page, slot, v, COUNT(DISTINCT CASE WHEN k='view' THEN vid END) AS visitors, COUNT(DISTINCT CASE WHEN k='lead' THEN vid END) AS leads, COUNT(DISTINCT CASE WHEN k='booked' THEN vid END) AS booked FROM ev WHERE ts>=? AND page NOT IN ('home','meetup','free15') ${test ? '' : "AND vid NOT LIKE 'test%'"} GROUP BY page, slot, v`).bind(from),
    env.STATS.prepare('SELECT slug,name,a,b,who,ts,off FROM links ORDER BY ts DESC'),
    env.STATS.prepare('SELECT id,src,amt,note,d,who FROM costs WHERE d>=? ORDER BY d DESC').bind(from),
    env.STATS.prepare('SELECT id,src,amt,kind,email,note,d,who FROM sales WHERE d>=? ORDER BY d DESC').bind(from),
  ]);
  // Shops from our own list who later signed up or booked (the lead portal outreach row).
  const O = await env.DB.prepare("SELECT l.id, l.n, MIN(e.ts) AS ts, MAX(CASE WHEN e.a LIKE 'Booked%' THEN 1 ELSE 0 END) AS bk FROM ev e JOIN leads l ON l.id=e.lead WHERE COALESCE(l.g,'')<>'Signed up' AND e.who IN ('Website','GoHighLevel') AND e.ts>=? GROUP BY l.id ORDER BY ts DESC").bind(from).all();
  return { me, ghl: !!env.GHL_TOKEN, rows: E.results, links: Lk.results, costs: C.results, sales: S.results, outreach: O.results };
}
async function moneyAct(b, me, env) {
  await minit(env);
  const now = Date.now(), day = x => { const t = Date.parse(String(x || '')); return isFinite(t) ? t + 12 * 36e5 : now; }; // a date picked on the page counts from midday, so the time zone can't push it into the day before
  const amt = Math.round(Number(String(b.amt || '').replace(/[$,\s]/g, '')) * 100) / 100;
  if (b.op === 'link') {
    const name = String(b.name || '').trim().slice(0, 80), a = String(b.a || ''), bb = String(b.b || '');
    const page = x => /^\/[a-z0-9\-\/]*$/i.test(x) && x.length < 80;
    if (!name || !page(a) || (bb && !page(bb))) return J({ error: 'Give the link a name and pick a page.' }, 400);
    const full = String(b.slug || name).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, ''), cut = n => full.length > n ? full.slice(0, n + 1).replace(/-[^-]*$/, '') || full.slice(0, n) : full; // cut at a whole word
    let slug = cut(24) || 'link';
    for (let i = 2; await env.STATS.prepare('SELECT 1 FROM links WHERE slug=?').bind(slug).first(); i++) slug = (cut(21) || 'link') + '-' + i;
    await env.STATS.prepare('INSERT INTO links (slug,name,a,b,who,ts) VALUES (?,?,?,?,?,?)').bind(slug, name, a, bb && bb !== a ? bb : null, me, now).run();
    return J({ ...(await money(env, me, new URL('https://x/?from=0'))), made: slug });
  }
  if (b.op === 'linkoff' || b.op === 'linkon') {
    if (!MK.test(String(b.slug || ''))) return J({ error: 'link' }, 400);
    await env.STATS.prepare('UPDATE links SET off=? WHERE slug=?').bind(b.op === 'linkoff' ? 1 : 0, b.slug).run();
  } else if (b.op === 'cost' || b.op === 'sale') {
    if (!KEY.test(String(b.src || ''))) return J({ error: 'Pick where it came from.' }, 400);
    if (!(amt > 0) || amt > 1e7) return J({ error: 'Enter the dollar amount.' }, 400);
    if (b.op === 'cost') await env.STATS.prepare('INSERT INTO costs (src,amt,note,d,who,ts) VALUES (?,?,?,?,?,?)').bind(b.src, amt, String(b.note || '').slice(0, 200), day(b.d), me, now).run();
    else await env.STATS.prepare('INSERT INTO sales (src,amt,kind,email,note,d,who,ts) VALUES (?,?,?,?,?,?,?,?)').bind(b.src, amt, b.kind === 'back' ? 'back' : 'first', String(b.email || '').trim().toLowerCase().slice(0, 200), String(b.note || '').slice(0, 200), day(b.d), me, now).run();
  } else if (b.op === 'del') {
    const t = b.t === 'sale' ? 'sales' : b.t === 'cost' ? 'costs' : null;
    if (!t || !Number.isInteger(b.id)) return J({ error: 'del' }, 400);
    await env.STATS.prepare(`DELETE FROM ${t} WHERE id=?`).bind(b.id).run();
  } else return J({ error: 'op' }, 400);
  return J(await money(env, me, new URL('https://x/?from=' + (Number(b.from) || 0))));
}
// Where did this buyer first come from? Our own list first, then the tags GoHighLevel kept when they signed up.
async function moneyWho(env, u) {
  const em = String(u.searchParams.get('email') || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return J({ error: 'email' }, 400);
  const mine = await env.DB.prepare("SELECT n, g FROM leads WHERE lower(e)=? LIMIT 1").bind(em).first();
  if (mine && mine.g !== 'Signed up') return J({ src: 'outreach|list', name: mine.n, why: 'On our own list (lead portal outreach)' });
  if (!env.GHL_TOKEN) return J({ src: null, why: 'GoHighLevel is not connected' });
  try {
    const r = await ghl(env, 'GET', `/contacts/?locationId=${encodeURIComponent(cfg(env).location || '')}&query=${encodeURIComponent(em)}&limit=1`);
    const c = (r.contacts || [])[0];
    if (!c) return J({ src: null, why: 'Not in GoHighLevel under that email' });
    const at = [].concat(c.attributions || []), a = at.find(x => x.isFirst) || at[0] || c.attributionSource || {};
    let us = a.utmSource || '', uc = a.utmCampaign || a.campaign || '', ut = a.utmContent || '';
    if (!us && a.url) { try { const p = new URL(a.url).searchParams; us = p.get('utm_source') || p.get('src') || ''; uc = uc || p.get('utm_campaign') || ''; ut = ut || p.get('utm_content') || ''; } catch (e) {} }
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.contactName || '';
    const d = String(c.phone || '').replace(/\D/g, '').slice(-10);
    if (d.length === 10) { // the same shop on our own list, by phone: they came from our outreach
      const m = await env.DB.prepare("SELECT n, g FROM leads WHERE substr(replace(replace(replace(replace(replace(replace(p,'-',''),'(',''),')',''),' ',''),'.',''),'+',''),-10)=? LIMIT 1").bind(d).first();
      if (m && m.g !== 'Signed up') return J({ src: 'outreach|list', name: name || m.n, why: 'On our own list (lead portal outreach), matched by phone' });
    }
    if (!us) return J({ src: null, name, why: 'GoHighLevel has no tag for them' + (a.referrer ? ' (came from ' + String(a.referrer).slice(0, 60) + ')' : '') });
    return J({ src: [mclean(uc) || 'tagged', mclean(us), mclean(ut) || 'base'].join('|'), name, why: 'From the tags GoHighLevel kept when they signed up' });
  } catch (e) { return J({ src: null, why: 'GoHighLevel lookup failed' }); }
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    try {
      if (u.pathname === '/hooks/ghl-slots' && req.method === 'GET') return slots(env);
      if (u.pathname === '/hooks/ghl-book' && req.method === 'POST') { try { await init(env); } catch (e) {} return book(req, env); }
      await init(env);
      if (u.pathname === '/hooks/ghl' && req.method === 'POST') return hook(u, req, env);
      if (u.pathname === '/c/api/me' && req.method === 'GET') { const f = await ownerFind(req, env, u); return f.err || J({ name: f.c.name, preview: !!f.team, data: ownerView(JSON.parse(f.c.data || '{}')) }); }
      if (u.pathname === '/c/api/ask' && req.method === 'POST') return ownerAsk(req, env, u);
      if (!u.pathname.startsWith('/admin/api/')) return J({ error: 'not found' }, 404);
      const me = await who(req, env); if (!me) return J({ error: 'sign in' }, 401);
      if (u.pathname === '/admin/api/leads' && req.method === 'GET') return J(await all(env, me));
      if (u.pathname === '/admin/api/act' && req.method === 'POST') return act(await req.json(), me, env, ctx);
      if (u.pathname === '/admin/api/money' && req.method === 'GET') return J(await money(env, me, u));
      if (u.pathname === '/admin/api/money' && req.method === 'POST') return await moneyAct(await req.json(), me, env);
      if (u.pathname === '/admin/api/money/who' && req.method === 'GET') return await moneyWho(env, u);
      if (u.pathname === '/admin/api/clients' && req.method === 'GET') return J(await clientsAll(env, me));
      if (u.pathname === '/admin/api/clients' && req.method === 'POST') return await clientsAct(await req.json(), me, env);
      return J({ error: 'not found' }, 404);
    } catch (e) { return J({ error: String(e).slice(0, 200) }, 500); }
  },
  async scheduled(ev, env, ctx) { await init(env); await jobs(env); try { await pull(env); } catch (e) {} try { await catchUp(env); } catch (e) {} },
};
