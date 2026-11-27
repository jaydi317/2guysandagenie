// Stand-in for Cloudflare: the real worker.js on a local SQLite "D1", a signed test sign-in, made-up shops only.
import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.argv[2] || path.join(HERE, '..', '..'), PORT = +process.argv[3] || 8787, DBFILE = process.argv[4] || path.join(HERE, 'test.db');
fs.copyFileSync(path.join(REPO, 'leads-api/worker.js'), path.join(HERE, 'worker.mjs'));
const W = (await import(pathToFileURL(path.join(HERE, 'worker.mjs')).href + '?' + Date.now())).default;
function d1(file) {
const sq = new DatabaseSync(file);
class Stmt { constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.sql, a.map(v => v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v)); }
  _p() { return sq.prepare(this.sql); }
  async first() { return this._p().get(...this.args) ?? null; }
  async all() { return { results: this._p().all(...this.args) }; }
  async run() { this._p().run(...this.args); return { success: true }; }
  _any() { return /^\s*(SELECT|WITH)/i.test(this.sql) ? { results: this._p().all(...this.args) } : (this._p().run(...this.args), { results: [], success: true }); } }
return { prepare: s => new Stmt(s), batch: async list => { sq.exec('BEGIN'); try { const r = list.map(s => s._any()); sq.exec('COMMIT'); return r; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
}
const DB = d1(DBFILE), STATS = d1(DBFILE + '.stats'); // STATS plays the scoreboard database (2g-stats) for the Money Board
fs.copyFileSync(path.join(REPO, 'stats/worker.js'), path.join(HERE, 'stats.mjs'));
const SW = (await import(pathToFileURL(path.join(HERE, 'stats.mjs')).href + '?' + Date.now())).default;
// A signing key that plays Cloudflare Access.
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'test1' };
const u64 = b => Buffer.from(b).toString('base64url');
async function jwt(email, aud = 'testaud') { const h = u64(JSON.stringify({ alg: 'RS256', kid: 'test1' })), p = u64(JSON.stringify({ aud: [aud], email, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(h + '.' + p)); return h + '.' + p + '.' + u64(s); }
const GHLCALLS = []; globalThis.GHLCALLS = GHLCALLS;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => { url = String(url);
  if (url.includes('/cdn-cgi/access/certs')) return new Response(JSON.stringify({ keys: [jwk] }));
  if (url.startsWith('https://services.leadconnectorhq.com')) { GHLCALLS.push({ method: opt.method, url, body: opt.body ? JSON.parse(opt.body) : null });
    if (url.includes('/contacts/search/duplicate')) return new Response('{}');
    if (opt.method === 'GET' && url.includes('/contacts/?locationId=')) { const q = new URL(url).searchParams.get('query'); return new Response(JSON.stringify({ contacts: q === 'pat@example.com' ? [{ id: 'c8', firstName: 'Pat', phone: '+13175550101', source: '2guysandagenie.com free 15' }] : q === 'buyer@example.com' ? [{ id: 'c9', firstName: 'Test', lastName: 'Buyer', attributions: [{ isFirst: true, url: 'https://2guysandagenie.com/book/?utm_campaign=mailer&utm_source=postcard1&utm_content=doodle' }] }] : [] })); }
    if (url.includes('brokenT3')) return new Response('{"message":"Contact not found"}', { status: 400 });
    if (opt.method === 'GET' && /\/contacts\/[^/?]+$/.test(url)) { const id = url.split('/').pop(); return new Response(JSON.stringify({ contact: { id, source: id.startsWith('theirs') ? 'free 15' : 'Local Business Database' } })); }
    if (opt.body && JSON.parse(opt.body).email === 'dupe@example.com') return new Response(JSON.stringify({ message: 'This location does not allow duplicated contacts.' }), { status: 400 });
    if (/\/contacts\/$/.test(url)) return new Response(JSON.stringify({ contact: { id: 'gc-' + GHLCALLS.length } }));
    if (url.includes('/opportunities/') && opt.method === 'POST') return new Response(JSON.stringify({ opportunity: { id: 'go-' + GHLCALLS.length } }));
    return new Response(JSON.stringify({ note: { id: 'n' + GHLCALLS.length } })); }
  return realFetch(url, opt); };
const env = { HOOK_KEY: 'hk', DB, STATS, TEAM: 'test.cloudflareaccess.com', AUD: 'testaud', CAUD: 'testcaud', GHL_TOKEN: process.env.GHL ? 'x' : '', GHL_CFG: JSON.stringify({ location: 'L', pipeline: 'P', stages: Object.fromEntries(['Not touched yet', 'Slydial sent', 'Tried, no owner yet', 'Talked to the owner', '15 minutes booked', '15 minutes done', 'Offer made', 'Client', 'Not now'].map((s, i) => [s, 'S' + i])), f: { id: 'f1', tier: 'f2', kind: 'f3', found: 'f4', why: 'f5' }, users: { Paul: 'uP', Jimmy: 'uJ', Daegan: 'uD' } }) };
const EMAIL = { Paul: 'paul@2guysandagenie.com', Jimmy: 'jimmydavisprivate@gmail.com', Daegan: 'daegan@maximum-leverage.com' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/_ghl') { res.end(JSON.stringify(GHLCALLS)); return; }
  if (u.pathname === '/_cron') { const w = []; await W.scheduled({}, env, { waitUntil: p => w.push(p) }); await Promise.allSettled(w); res.end('ok'); return; }
  if (u.pathname === '/h' || u.pathname.startsWith('/go/') || u.pathname === '/board') { // the scoreboard Worker (2g-stats), on the same stand-in
    const out = await SW.fetch(new Request('https://2guysandagenie.com' + req.url, { headers: { cookie: req.headers.cookie || '', 'user-agent': 'test' } }), { DB: STATS, KEY: 'k' }, { waitUntil: p => p });
    await new Promise(r => setTimeout(r, 30)); const h = {}; out.headers.forEach((v, k) => h[k] = v); res.writeHead(out.status, h); res.end(await out.text()); return; }
  if (u.pathname.startsWith('/c/api/')) { // the owner sign-in (a second Access app): cookie owner=<email>, or who=<team member>
    const caud = env.CAUD;
    const ck = req.headers.cookie || '', ow = (/(?:^|; )owner=([^;]+)/.exec(ck) || [])[1], tm = (/(?:^|; )who=(\w+)/.exec(ck) || [])[1];
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = { 'content-type': 'application/json' }; const em = ow ? decodeURIComponent(ow) : tm ? EMAIL[tm] : null;
    if (em) headers['Cf-Access-Jwt-Assertion'] = await jwt(em, caud);
    const out = await W.fetch(new Request('https://2guysandagenie.com' + req.url, { method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), env, { waitUntil: p => p });
    res.writeHead(out.status, { 'content-type': 'application/json' }); res.end(await out.text()); return; }
  if (u.pathname.startsWith('/admin/api/') || u.pathname.startsWith('/hooks/')) {
    const who = (/(?:^|; )who=(\w+)/.exec(req.headers.cookie || '') || [])[1] || 'Paul';
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = { 'content-type': req.headers['content-type'] || 'application/json' };
    if (who !== 'Nobody') headers['Cf-Access-Jwt-Assertion'] = await jwt(EMAIL[who]);
    const r = new Request('https://2guysandagenie.com' + req.url, { method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const waits = []; const out = await W.fetch(r, env, { waitUntil: p => waits.push(p) }); await Promise.allSettled(waits);
    res.writeHead(out.status, { 'content-type': 'application/json' }); res.end(await out.text()); return; }
  let f = path.join(REPO, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(REPO) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(PORT, () => console.log('up ' + PORT));
