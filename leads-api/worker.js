// 2 Guys lead portal: the shared record behind /admin/leads/.
// Every route under /admin/api/ sits behind the Admin sign-in (Cloudflare Access); the Worker checks the sign-in token itself too.
// /admin/api/leads   GET   every shop, its stage, who's working it, notes and history
// /admin/api/act     POST  one change: did, undo, stage, note, email, claim, add
// /hooks/ghl         POST  GoHighLevel tells us something happened (needs ?key=)
// Every few minutes (cron): run queued jobs (import, load into GoHighLevel) and pull stage changes made in GoHighLevel.
// No shop is named in this file. The records live in the D1 database, never in the site's files.

const STAGES = ['Not touched yet', 'Slydial sent', 'Tried, no owner yet', 'Talked to the owner', '15 minutes booked', '15 minutes done', 'Offer made', 'Client', 'Not now'];
const PEOPLE = { 'daegan@maximum-leverage.com': 'Daegan', 'daegansmith@me.com': 'Daegan', 'jimmydavisprivate@gmail.com': 'Jimmy', 'paul@2guysandagenie.com': 'Paul' };
const GHL = 'https://services.leadconnectorhq.com';
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const b64 = x => { x = x.replace(/-/g, '+').replace(/_/g, '/'); x += '='.repeat((4 - x.length % 4) % 4); return Uint8Array.from(atob(x), c => c.charCodeAt(0)); };
let ready = false, certs = null, certsAt = 0;

async function init(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, g TEXT, n TEXT, k TEXT, t TEXT, a TEXT, p TEXT, u TEXT, e TEXT, rt REAL, rv INTEGER, mi REAL, w TEXT, f TEXT, src TEXT, custom INTEGER DEFAULT 0, st TEXT, wk TEXT, note TEXT, gc TEXT, go TEXT, gs TEXT, gn TEXT, upd INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS ev (id INTEGER PRIMARY KEY AUTOINCREMENT, lead TEXT, ts INTEGER, who TEXT, a TEXT, p TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS ev_lead ON ev (lead, id)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, arg TEXT, done INTEGER DEFAULT 0, out TEXT, ts INTEGER)'),
  ]);
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
  const [L, E] = await env.DB.batch([
    env.DB.prepare('SELECT id,g,n,k,t,a,p,u,e,rt,rv,mi,w,f,src,custom,st,wk,note,gc FROM leads ORDER BY id'),
    env.DB.prepare('SELECT lead,ts,who,a,p FROM ev ORDER BY id'),
  ]);
  const H = {}; for (const e of E.results) (H[e.lead] = H[e.lead] || []).push({ ts: e.ts, by: e.who, a: e.a, p: e.p });
  return { me, ghl: !!env.GHL_TOKEN, leads: L.results.map(x => ({ ...x, st: x.st || STAGES[0], h: H[x.id] || [] })) };
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
  for (let page = 1; page <= 10; page++) {
    const r = await ghl(env, 'GET', `/opportunities/search?location_id=${c.location}&pipeline_id=${c.pipeline}&limit=100&page=${page}`);
    const ops = r.opportunities || [];
    for (const o of ops) {
      const x = await env.DB.prepare('SELECT id,st,gs FROM leads WHERE go=?').bind(o.id).first();
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

async function act(b, me, env, ctx) {
  const id = String(b.id || ''), now = Date.now();
  if (b.op === 'add') {
    const n = String(b.n || '').trim().slice(0, 120); if (!n) return J({ error: 'name' }, 400);
    const nid = 'C' + now.toString(36).toUpperCase(), s = v => String(v || '').trim().slice(0, 400);
    await env.DB.prepare('INSERT INTO leads (id,g,n,k,t,a,p,u,e,w,f,src,custom,st,upd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)').bind(nid, ['A', 'B', 'Worth a visit'].includes(b.g) ? b.g : 'Worth a visit', n, s(b.k) || 'Business', s(b.t) || 'Town not set', s(b.a), s(b.p), s(b.u), '', s(b.w) || 'Added by hand.', '', 'Added by ' + me, STAGES[0], now).run();
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
  if (!x && d.length === 10) x = await env.DB.prepare("SELECT id,st FROM leads WHERE replace(p,'-','')=?").bind(d).first();
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
      await init(env);
      if (u.pathname === '/hooks/ghl' && req.method === 'POST') return hook(u, req, env);
      if (u.pathname === '/hooks/ghl-slots' && req.method === 'GET') return slots(env);
      if (u.pathname === '/hooks/ghl-book' && req.method === 'POST') return book(req, env);
      if (!u.pathname.startsWith('/admin/api/')) return J({ error: 'not found' }, 404);
      const me = await who(req, env); if (!me) return J({ error: 'sign in' }, 401);
      if (u.pathname === '/admin/api/leads' && req.method === 'GET') return J(await all(env, me));
      if (u.pathname === '/admin/api/act' && req.method === 'POST') return act(await req.json(), me, env, ctx);
      return J({ error: 'not found' }, 404);
    } catch (e) { return J({ error: String(e).slice(0, 200) }, 500); }
  },
  async scheduled(ev, env, ctx) { await init(env); await jobs(env); try { await pull(env); } catch (e) {} },
};
