/* Where did this visitor come from? (Nov 25, 2026)
   On a landing page: if the link carries utm_ tags (a postcard QR code, an ad, a group link),
   remember them in this browser and count a view on the scoreboard.
   On an after-sign-up page (/book/booked/, /thanks/), or when a time is picked on /free15/start/: count a booking for the source remembered,
   once per browser per source.
   Scoreboard rows: page = utm_campaign (e.g. mailer), spot = utm_source (e.g. postcard1),
   version = utm_content (doodle), or "base" when there is none (the headline front).
   Nothing here touches the GoHighLevel forms, the calendar or the pixels. */
(function () {
  var W = 'https://2g-stats.daegansmith.workers.dev/h';
  var DONE = ['/book/booked/', '/thanks/'];
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
  function credit() {
    var t = null;
    try { t = JSON.parse(g('2g-src') || 'null'); } catch (e) {}
    if (!t || !t.p || !t.slot || !t.v) return;
    var key = '2g-booked-' + t.p + '-' + t.slot + '-' + t.v;
    if (g(key) === '1') return;
    s(key, '1');
    ping('signup', t);
  }
  // The free 15 sign-up books inside its own page, so it calls this when a time is picked.
  window.srcBooked = credit;
  var path = location.pathname.replace(/\/?$/, '/');
  if (DONE.indexOf(path) > -1) { credit(); return; }
  var src = q.get('utm_source') || q.get('src');
  if (!src) return;
  var t2 = { p: clean(q.get('utm_campaign') || 'tagged'), slot: clean(src), v: clean(q.get('utm_content') || 'base') || 'base', page: clean(path.split('/')[1] || 'home') };
  if (!t2.p || !t2.slot) return;
  s('2g-src', JSON.stringify(t2));
  ping('view', t2);
})();
