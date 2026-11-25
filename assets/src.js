/* Where did this visitor come from? (Nov 25, 2026; leads, bookings and untagged visits added 4:50pm)
   Feeds the Money Board (/admin/money/) through the scoreboard Worker.
   On a landing page:
     - A tagged link (utm_ tags or src=: a postcard QR code, a /go/ link, a group leader link) is remembered
       in this browser and counted as a visit for that source.
     - An untagged first visit is counted under "No source", by where it came from (google, facebook,
       typed = no referrer: typed address, bookmark, email or text app) and the page it landed on.
       It's remembered only if nothing tagged was remembered before, so a tagged source keeps the credit.
   After a sign-up: /thanks/ counts a lead. /book/booked/, or a time picked on /free15/start/ (it calls
   window.srcBooked), counts a lead and a booked call. Each once per browser per source.
   Rows: p = utm_campaign (mailer, link, tagged when there's none, none for untagged), slot = utm_source or src
   (postcard1, the link's name, leaders), version = utm_content (doodle, a, b) or "base".
   Nothing here touches the GoHighLevel forms, the calendar or the pixels. */
(function () {
  var W = 'https://2g-stats.daegansmith.workers.dev/h';
  var LEAD = ['/thanks/'], BOOK = ['/book/booked/'];
  function g(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function clean(x) { return String(x || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24); }
  var q = new URLSearchParams(location.search);
  var vid = g('2g-vid');
  if (q.get('test') === '1' && (!vid || vid.indexOf('test') !== 0)) vid = null;
  if (!vid) {
    vid = (q.get('test') === '1' ? 'test' : '') + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    s('2g-vid', vid);
  }
  function ping(k, t) {
    var url = W + '?k=' + k + '&vid=' + vid + '&p=' + t.p + '&s=' + encodeURIComponent(t.slot + '.' + t.v);
    try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) {}
    try { new Image().src = url; } catch (e) {}
  }
  function saved() {
    var t = null;
    try { t = JSON.parse(g('2g-src') || 'null'); } catch (e) {}
    return t && t.p && t.slot && t.v ? t : { p: 'none', slot: 'unknown', v: 'base' };
  }
  function credit(kinds) {
    var t = saved();
    kinds.forEach(function (k) {
      var key = '2g-' + k + '-' + t.p + '-' + t.slot + '-' + t.v;
      if (g(key) === '1') return;
      s(key, '1');
      ping(k, t);
    });
  }
  // The free 15 sign-up books inside its own page, so it calls this when a time is picked.
  // "signup" keeps the old scoreboard rows counting; "lead" and "booked" feed the Money Board.
  window.srcBooked = function () { credit(['lead', 'booked', 'signup']); };
  var path = location.pathname.replace(/\/?$/, '/');
  if (BOOK.indexOf(path) > -1) { window.srcBooked(); return; }
  if (LEAD.indexOf(path) > -1) { credit(['lead', 'signup']); return; }
  var landed = clean(path.split('/')[1] || 'home') || 'home';
  var src = q.get('utm_source') || q.get('src');
  if (src) {
    var t2 = { p: clean(q.get('utm_campaign') || 'tagged'), slot: clean(src), v: clean(q.get('utm_content') || 'base') || 'base' };
    if (!t2.p || !t2.slot) return;
    s('2g-src', JSON.stringify(t2));
    ping('view', t2);
    return;
  }
  // Untagged: count it once per visit, only when they arrived from outside the site.
  var ref = '';
  try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
  if (/(^|\.)2guysandagenie\.com$/.test(ref)) return;
  try { if (sessionStorage.getItem('2g-landed')) return; sessionStorage.setItem('2g-landed', '1'); } catch (e) {}
  var from = !ref ? 'typed'
    : /(^|\.)google\./.test(ref) ? 'google'
    : /(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(ref) ? 'facebook'
    : /(^|\.)instagram\.com$/.test(ref) ? 'instagram'
    : /(^|\.)(linkedin\.com|lnkd\.in)$/.test(ref) ? 'linkedin'
    : /(^|\.)(t\.co|x\.com|twitter\.com)$/.test(ref) ? 'x'
    : /(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com)$/.test(ref) ? 'other-search'
    : clean(ref);
  var t3 = { p: 'none', slot: from || 'typed', v: landed };
  if (!g('2g-src')) s('2g-src', JSON.stringify(t3));
  ping('view', t3);
})();
