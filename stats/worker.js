// 2 Guys scoreboard: counts who saw which version of each rotating spot, and who signed up.
// /h       record (k=view|signup, vid, p=page, s=slot.version~slot.version)
// /board   the scoreboard page (needs ?key=)
// /data    the same numbers as JSON (needs ?key=)

const NAMES = {
  home: {
    _title: 'Home page',
    hl: { _title: 'Headline', hl1: "Walk In With A Problem. Walk Out Without It. By 9 O'Clock.", hl2: "What Would You Pay Never To Do Again? Bring It Monday Night. It's Free.", hl3: 'Bring The One Job You Hate Most. Leave Monday Night Never Having To Do It Again.' },
    hero: { _title: 'Picture under the headline', doodle: '7 PM / 9 PM doodle', thread: 'Text thread (on a ladder)', lock: 'Lock screen at 9:00', door: 'Launch Fishers door', ticket: 'Work order, HANDLED' },
    ladder: { _title: 'Picture: on the ladder', doodle: 'Ladder doodle', log: 'Call log', customer: "What your customer sees", clock: 'The 4-second clock' },
    work: { _title: 'Picture: the work vs. the paperwork', doodle: 'Plumber and robot doodle', list: "Tonight's list", desk: 'The 10 PM desk' },
    shop: { _title: 'Picture: never been to your shop', doodle: 'Robot reading doodle', nametag: 'HELLO my name is ChatGPT' },
    jq1: { _title: 'Jamon quote, first box', q1: '"Jimmy, just let me drive."', q2: '"$15,000 to $20,000 a month, and now..."', q3: '"With AI by itself... it would have failed"' },
    jq2: { _title: 'Jamon quote, second box', q1: '"He can give you your life back"', q2: '"No business worth building destroys the family"' },
  },
  meetup: {
    _title: 'Meetup page',
    hl: { _title: 'Headline', hl1: "Walk In With A Problem. Walk Out Without It. By 9 O'Clock.", hl2: "What Would You Pay Never To Do Again? Bring It Monday Night. It's Free.", hl3: 'Bring The One Job You Hate Most. Leave Monday Night Never Having To Do It Again.', jamon: 'Jamon ad visitors: "Jamon Brought One Problem..."' },
    open: { _title: 'Opening block', tuesday: 'Picture Tuesday morning (7 AM doodle)', monday: "Here's Monday night (7 PM / 9 PM doodle)" },
  },
};

const OK = /^[a-z0-9-]{1,24}$/;
const H = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
let ready = false;

async function init(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS ev (ts INTEGER, k TEXT, vid TEXT, page TEXT, slot TEXT, v TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS ev_ps ON ev (page, slot, v, k)'),
  ]);
  ready = true;
}

async function record(u, req, env) {
  const k = u.searchParams.get('k'), vid = u.searchParams.get('vid') || '', p = u.searchParams.get('p') || '', s = u.searchParams.get('s') || '';
  const ua = req.headers.get('user-agent') || '';
  if (!['view', 'signup'].includes(k) || !/^[a-z0-9]{6,24}$/.test(vid) || !OK.test(p) || /bot|crawl|spider|preview|headless|facebookexternalhit/i.test(ua)) return;
  const pairs = s.split('~').slice(0, 12).map(x => x.split('.')).filter(x => x.length === 2 && OK.test(x[0]) && OK.test(x[1]));
  if (!pairs.length) return;
  await init(env);
  const now = Date.now();
  await env.DB.batch(pairs.map(([slot, v]) => env.DB.prepare('INSERT INTO ev VALUES (?,?,?,?,?,?)').bind(now, k, vid, p, slot, v)));
}

async function numbers(env, all) {
  await init(env);
  const where = all ? '' : "WHERE vid NOT LIKE 'test%'";
  const { results } = await env.DB.prepare(
    `SELECT page, slot, v, COUNT(DISTINCT CASE WHEN k='view' THEN vid END) AS seen, COUNT(DISTINCT CASE WHEN k='signup' THEN vid END) AS signed FROM ev ${where} GROUP BY page, slot, v`
  ).all();
  return results;
}

function verdict(rows) {
  const sig = rows.reduce((a, r) => a + r.signed, 0);
  const r = rows.filter(x => x.seen > 0).map(x => ({ ...x, rate: x.signed / x.seen })).sort((a, b) => b.rate - a.rate);
  if (r.length < 2 || sig < 10) return ['early', 'Too early to call. Needs about 10 signups in this spot.'];
  const [a, b] = r, p = (a.signed + b.signed) / (a.seen + b.seen), se = Math.sqrt(p * (1 - p) * (1 / a.seen + 1 / b.seen));
  const z = se ? (a.rate - b.rate) / se : 0;
  const nm = x => (NAMES[x.page]?.[x.slot]?.[x.v]) || x.v;
  if (z >= 1.96) return ['real', `${nm(a)} is winning, and the lead is real.`];
  if (z >= 1.28) return ['lean', `${nm(a)} is ahead. Leaning, not proven yet.`];
  return ['close', 'Too close to call. Keep rotating.'];
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function board(env, all, key) {
  const rows = await numbers(env, all);
  const pages = {};
  for (const r of rows) ((pages[r.page] ||= {})[r.slot] ||= []).push(r);
  let body = '';
  for (const pg of Object.keys(NAMES).concat(Object.keys(pages).filter(x => !NAMES[x]))) {
    if (!pages[pg]) continue;
    const pn = NAMES[pg] || {};
    body += `<h2>${esc(pn._title || pg)}</h2>`;
    for (const slot of Object.keys(pn).filter(x => x !== '_title').concat(Object.keys(pages[pg]).filter(x => !pn[x]))) {
      const list = pages[pg][slot];
      if (!list) continue;
      const sn = pn[slot] || {};
      for (const v of Object.keys(sn).filter(x => x !== '_title')) if (!list.some(x => x.v === v)) list.push({ page: pg, slot, v, seen: 0, signed: 0 });
      const [cls, say] = verdict(list);
      const max = Math.max(...list.map(x => (x.seen ? x.signed / x.seen : 0)), 0.0001);
      list.sort((a, b) => (b.seen ? b.signed / b.seen : 0) - (a.seen ? a.signed / a.seen : 0) || b.seen - a.seen);
      body += `<section><h3>${esc(sn._title || slot)}</h3><p class="v ${cls}">${esc(say)}</p><table><tr><th>Version</th><th>Saw it</th><th>Signed up</th><th>Rate</th></tr>`;
      for (const x of list) {
        const rate = x.seen ? x.signed / x.seen : 0;
        body += `<tr><td>${esc(sn[x.v] || x.v)}<i style="width:${Math.round((rate / max) * 100)}%"></i></td><td>${x.seen}</td><td>${x.signed}</td><td><b>${(rate * 100).toFixed(1)}%</b></td></tr>`;
      }
      body += '</table></section>';
    }
  }
  if (!body) body = '<p class="empty">No visits counted yet. The first numbers show up as soon as people land on the pages.</p>';
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Indiana/Indianapolis', dateStyle: 'medium', timeStyle: 'short' });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>2 Guys Scoreboard</title>
<style>:root{--bg:#fff;--ink:#111;--soft:#666;--rule:#ddd;--bar:#fff3c4;--card:#fafafa}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--ink:#f2f2f2;--soft:#aaa;--rule:#333;--bar:#5a4d12;--card:#1b1b1b}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Tahoma,Geneva,Verdana,sans-serif}main{max-width:640px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:26px;margin:0 0 4px}.sub{color:var(--soft);font-size:14px;margin:0 0 18px}h2{font-size:20px;margin:28px 0 8px;border-top:2px solid var(--ink);padding-top:14px}
section{background:var(--card);border:1px solid var(--rule);padding:12px 12px 6px;margin:0 0 14px}h3{font-size:16px;margin:0 0 4px}
.v{font-size:14px;margin:0 0 8px;font-weight:bold}.v.early,.v.close{color:var(--soft)}.v.real{color:#1a7f37}.v.lean{color:#b26b00}
table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;font-size:12px;color:var(--soft);font-weight:normal;border-bottom:1px solid var(--rule);padding:4px 4px}
td{padding:7px 4px;border-bottom:1px solid var(--rule);vertical-align:top}td:not(:first-child),th:not(:first-child){text-align:right;white-space:nowrap}
td i{display:block;height:6px;background:var(--bar);margin-top:5px}.empty{color:var(--soft)}.foot{font-size:13px;color:var(--soft);margin-top:24px}</style></head>
<body><main><h1>What's Winning</h1><p class="sub">Real visitors, live. Updated ${esc(now)}. Each person counts once per version they saw. Signups are credited to what they saw on the page they signed up from.</p>${body}
<p class="foot">"Real" means about 95% sure the leader isn't luck. Rates move a lot until each version has a few hundred visitors.${all ? '' : ' Test visits are left out.'}</p></main></body></html>`;
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...H, 'access-control-allow-methods': 'GET,POST' } });
    if (u.pathname === '/h') { ctx.waitUntil(record(u, req, env).catch(() => {})); return new Response(null, { status: 204, headers: H }); }
    const authed = env.KEY && u.searchParams.get('key') === env.KEY;
    if (u.pathname === '/board' && authed) return new Response(await board(env, u.searchParams.get('all') === '1'), { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } });
    if (u.pathname === '/data' && authed) return Response.json(await numbers(env, u.searchParams.get('all') === '1'), { headers: H });
    return new Response('Not found', { status: 404 });
  },
};
