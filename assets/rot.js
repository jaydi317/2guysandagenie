/* Rotations and the scoreboard counter.
   Each visitor keeps the same version of each rotating spot (stored in this browser).
   Views go to the counter once per page load; a signup is credited on /thanks.
   Nothing here touches the GoHighLevel form or the Meta pixel. */
(function () {
  var W = 'https://2g-stats.daegansmith.workers.dev/h';
  function g(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var q = new URLSearchParams(location.search);
  var vid = g('2g-vid');
  if (q.get('test') === '1' && (!vid || vid.indexOf('test') !== 0)) vid = null;
  if (!vid) {
    vid = (q.get('test') === '1' ? 'test' : '') + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    s('2g-vid', vid);
  }
  var seen = {};
  function ping(k, page, pairs) {
    var list = [];
    for (var x in pairs) list.push(x + '.' + pairs[x]);
    if (!list.length || W.indexOf('WORKERS_SUBDOMAIN') > -1) return;
    var url = W + '?k=' + k + '&vid=' + vid + '&p=' + page + '&s=' + encodeURIComponent(list.join('~'));
    try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) {}
    try { new Image().src = url; } catch (e) {}
  }
  window.R = {
    // Same version every visit for this browser; a new spot or a removed version gets a fresh pick.
    pick: function (slot, list) {
      var k = '2g-r-' + slot, v = g(k);
      if (list.indexOf(v) < 0) { v = list[Math.floor(Math.random() * list.length)]; s(k, v); }
      return v;
    },
    // Show the chosen child of a rotating block (children carry data-v; all but the default start hidden).
    show: function (el, slot) {
      if (!el) return;
      var kids = el.querySelectorAll('[data-v]'), list = [];
      for (var i = 0; i < kids.length; i++) list.push(kids[i].getAttribute('data-v'));
      var v = R.pick(slot, list);
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].getAttribute('data-v') === v) kids[j].removeAttribute('hidden'); else kids[j].setAttribute('hidden', '');
      }
      R.mark(slot, v);
      return v;
    },
    mark: function (slot, v) { seen[slot] = String(v); },
    send: function (page) {
      s('2g-seen-' + page, JSON.stringify(seen));
      s('2g-last', page);
      ping('view', page, seen);
    },
    // On /thanks: credit the versions seen on the page they signed up from, once per browser.
    signup: function () {
      if (g('2g-signed') === '1') return;
      var page = g('2g-last'), pairs = null;
      try { pairs = JSON.parse(g('2g-seen-' + page) || 'null'); } catch (e) {}
      if (!page || !pairs) return;
      s('2g-signed', '1');
      ping('signup', page, pairs);
    }
  };
})();
