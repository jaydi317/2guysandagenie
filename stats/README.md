# 2 Guys scoreboard (Cloudflare Worker)

What it does: counts, for every rotating spot on the home page and /meetup, how many people saw each version and how many of them signed up. The scoreboard page shows what's winning.

Deploy (Cloudflare account daegansmith@me.com):
1. Create a D1 database named `2g-stats`.
2. Create a Worker named `2g-stats` from `stats/worker.js` (module syntax), with:
   - a D1 binding `DB` to `2g-stats`;
   - a plain-text variable `KEY` set to a long random string (the scoreboard password).
3. Turn on its workers.dev URL. The worker creates its own table on first use.
4. In `assets/rot.js`, replace `https://2g-stats.WORKERS_SUBDOMAIN.workers.dev/h` with the real workers.dev URL + `/h`. Until then the pages rotate but send nothing.
5. Scoreboard: `https://2g-stats.<subdomain>.workers.dev/board?key=<KEY>`. Add `&all=1` to include test visits (any visit opened with `?test=1`).

Tested locally with wrangler dev on Nov 8: rotation is sticky per visitor; views and signups are counted once per person per version; signups are credited to the page they signed up from; the GHL form and the Meta pixel lines are byte-identical to the archived pages (archive/2026-11-08-pre-rotation/).
