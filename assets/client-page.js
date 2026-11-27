// 2 Guys client pages (Nov 27, 2026): draws one owner's page from his record.
// Used by /c/ (the owner, signed in with his email code) and by /admin/clients/ (the team's "What he sees" preview).
// No client is named in this file. The records live in the private database (leads-api, table clients).
(function () {
  var STAGES = ['Free 15 Minutes', 'What We Found', 'The Master Plan', 'Better Every Month'];
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function link(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) || /^\/[^/]/.test(u) ? esc(u) : ''; }
  function ph(x, f) { return x ? esc(x) : '<span class="ph">' + esc(f || '_') + '</span>'; }
  function day(ts) { if (!ts) return ''; var d = new Date(ts); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function para(t) { return esc(t).split(/\n+/).filter(Boolean).map(function (p) { return '<p>' + p + '</p>'; }).join(''); }
  function road(d) {
    var L = (d.roadL && d.roadL.length) ? d.roadL : STAGES, n = +d.stage || 0, h = '<div class="road5" style="grid-template-columns:repeat(' + L.length + ',minmax(0,1fr))">';
    for (var i = 0; i < L.length; i++) h += '<div class="' + (i < n ? 'done' : (i == n ? 'now' : '')) + '"><b>' + (i < n ? '✓ Done' : (i == n ? 'Now' : 'Next')) + '</b>' + esc(L[i]) + '</div>';
    return h + '</div>';
  }
  function item(x, kind) {
    var tag = kind === 'done' ? '<span class="tag done">Done</span>' : x.st === 'Scheduled' ? '<span class="tag wip">Up next</span>' : '<span class="tag wip">In progress</span>';
    var h = '<div class="item"><div class="top"><span class="t">' + esc(x.t) + '</span>' + tag + '</div><div class="d">' + (x.d ? '<p style="margin:6px 0 0">' + esc(x.d) + '</p>' : '');
    if (kind === 'done') {
      if (x.how) h += '<p style="margin:6px 0 0"><b>How to use it:</b> ' + esc(x.how) + '</p>';
      if (x.hrs !== undefined) h += '<p style="margin:6px 0 0"><b>Gives you back about ' + ph(x.hrs, '_') + ' hours a week.</b></p>';
      if (link(x.link)) h += '<p style="margin:6px 0 0"><a href="' + link(x.link) + '">Open it</a></p>';
    } else if (x.when) h += '<p style="margin:6px 0 0"><b>' + esc(x.when) + '</b></p>';
    return h + '</div></div>';
  }
  function boxes(p) {
    p = p || {}; if (![].concat(p.q || [], p.b || [], p.s || [], p.n || []).length) return '';
    function b(t, a, c) { return '<div' + (c ? ' class="skip"' : '') + '><h4>' + t + '</h4><ul>' + (a || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }
    return '<section class="s"><h2>Your Plan.</h2><p class="small">Everything we found, in four boxes. You pick what\'s next. ✓ means you picked it.</p><div class="boxes">' + b('Quick wins', p.q) + b('Big moves', p.b) + b('Small fixes', p.s) + b('Not now', p.n, 1) + '</div></section>';
  }
  // d = the owner's record (already stripped of team-only parts). opt.ask = true draws a working question box.
  window.drawClientPage = function (d, opt) {
    d = d || {}; opt = opt || {};
    var items = d.items || [], wip = items.filter(function (i) { return i.st === 'Working on' || i.st === 'Scheduled'; }), done = items.filter(function (i) { return i.st === 'Done'; });
    var h = '<p class="kicker">' + esc(d.who) + '</p><h1>' + esc(d.biz) + '.</h1><p class="small">Your one link for everything we\'re doing together.' + (d.upd ? ' Updated ' + day(d.upd) + '.' : '') + '</p>';
    h += road(d);
    var nx = d.next || {};
    if (nx.h) h += '<div class="next"><p class="kicker">' + esc(nx.k || 'Your Next Step') + '</p><h3>' + esc(nx.h) + '</h3>' + para(nx.p) + (nx.when ? '<p><b>' + esc(nx.when) + '</b></p>' : '') + (nx.btn && link(nx.link) ? '<a class="btn" href="' + link(nx.link) + '">' + esc(nx.btn) + '</a>' : '') + '</div>';
    var shown = (d.notes || []).filter(function (n) { return n.show; });
    if (shown.length) h += shown.map(function (n) { return '<div class="qa"><p>' + esc(n.t) + '</p><p class="small" style="margin:0">' + day(n.ts) + '</p></div>'; }).join('');
    if (d.asked) h += '<section class="s"><h2>What You Asked For.</h2><div class="quote"><p>' + esc(d.asked) + '</p><p class="who">You, on our call</p></div></section>';
    if (d.video && link(d.video.link)) h += '<section class="s"><h2>What We Found.</h2><p><a class="btn" href="' + link(d.video.link) + '">' + esc(d.video.t || 'Watch The Video') + '</a></p><p class="vid-cap">Made just for you.</p></section>';
    if (d.tools) h += '<section class="s"><h2>The Tools Out There.</h2>' + para(d.tools) + '</section>';
    if ((d.stats || []).length) h += '<div class="three">' + d.stats.map(function (s) { return '<div><span>' + esc(s[0]) + '</span><b>' + ph(s[1]) + '</b></div>'; }).join('') + '</div>';
    var of = d.offer || {};
    if (of.h) h += '<section class="s" id="offer"><h2>' + esc(of.h) + '</h2>' + para(of.p) + (of.btn && link(of.link) ? '<a class="btn" href="' + link(of.link) + '">' + esc(of.btn) + '</a>' : '') + '</section>';
    var need = (d.need || []).filter(function (n) { return !n.done; });
    if (need.length) h += '<section class="s"><h2>What We Need From You.</h2>' + need.map(function (n) { return '<p>☐ ' + esc(n.t) + '</p>'; }).join('') + '</section>';
    if (wip.length) h += '<section class="s"><h2>Working On Now.</h2>' + wip.map(function (x) { return item(x, 'wip'); }).join('') + '</section>';
    if (done.length) h += '<section class="s"><h2>Done For You.</h2>' + done.map(function (x) { return item(x, 'done'); }).join('') + '</section>';
    h += boxes(d.plan);
    h += '<section class="s"><h2>Ask Us Anything.</h2><div class="ask"><textarea id="askq" placeholder="Type your question."></textarea><p class="small" style="margin:8px 0 0">Paul, from our team, answers within one business day, and the answer stays here.</p><p style="margin-top:10px"><button class="btn ghost" id="askgo" type="button"' + (opt.ask ? '' : ' disabled title="Preview only"') + '>Send It</button> <span id="askmsg" class="small"></span></p></div>' +
      (d.qa || []).slice().reverse().map(function (q) { return '<div class="qa"><p><b>You asked:</b> ' + esc(q.q) + '</p><p>' + (q.a ? esc(q.a) + (q.aby ? ' <b>· ' + esc(q.aby) + '</b>' : '') : '<span class="tag wip">We\'re on it</span>') + '</p></div>'; }).join('') + '</section>';
    if ((d.meets || []).length) h += '<section class="s"><h2>Our Meetings.</h2>' + d.meets.map(function (m) { return '<div class="meet"><b>' + esc(m.t) + '</b>' + esc(m.d) + (link(m.link) ? ' <a href="' + link(m.link) + '">Open</a>' : '') + '</div>'; }).join('') + '</section>';
    if ((d.more || []).length) h += '<section class="s"><h2>More We Can Do For You.</h2><p class="small">Picked for your business. Ask about any of them above.</p><div class="more">' + d.more.map(function (m) { var a = link(m.link); return '<' + (a ? 'a href="' + a + '"' : 'div') + ' class="card"><span class="ct">' + esc(m.t) + '</span><span class="cd">' + (m.d ? esc(m.d) + '<br>' : '') + '<b>' + ph(m.price, 'price') + '</b></span></' + (a ? 'a' : 'div') + '>'; }).join('') + '</div></section>';
    var ag = d.agree || {};
    if (ag.text) h += '<section class="s"><h2>Your Agreement.</h2>' + para(ag.text) + (link(ag.link) ? '<p class="small"><a href="' + link(ag.link) + '">Read it</a></p>' : '') + '</section>';
    return h;
  };
  window.clientEsc = esc; window.clientLink = link;
})();
