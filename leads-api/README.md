# The lead portal's shared record

`worker.js` is the Cloudflare Worker `2g-leads`. It sits between the lead portal (/admin/leads/), a private database (Cloudflare D1, `2g-leads`) and GoHighLevel.

- The site's code is public, so no shop is ever named in these files. The records live in the database.
- Everything under /admin/api/ is behind the Admin sign-in (Cloudflare Access: Daegan, Jimmy, Paul).
- Each tap in the portal is saved with who made it, so all three see the same record.
- Once the Worker has a GoHighLevel key (`GHL_TOKEN`), each tap also moves the shop's deal card in the "Local Leads (Lead Portal)" pipeline and adds a note to the contact, and stage changes made in GoHighLevel come back within a few minutes.
- `/hooks/ghl?key=...` is where GoHighLevel can tell the portal something happened (a sign-up, a booked call).

To change it: edit `worker.js`, test it on the local stand-in (`leads-api/test/`, made-up shops only), then redeploy the Worker in Cloudflare (Workers, 2g-leads):
  1. Check the live code matches this repo's last version first. If it doesn't, stop and find out why before replacing it.
  2. Upload with the D1 binding named and `keep_bindings: ["plain_text","secret_text"]`, so the settings and secrets stay. Then confirm all eight bindings and the 3-minute timer are still there.
  3. Write down the version you replaced, so it can be put back in a minute.
  4. After the next timer run (within 3 minutes), check the database shows the change. Settings that are not in this file: `AUD`, `TEAM`, `GHL_CFG` (plain), and `DATA_KEY`, `HOOK_KEY`, `GHL_TOKEN` (secret).
- Mail and email (Nov 23, postcards Nov 24): the database also holds the six pieces' master words (table `pieces`: three postcards locked Nov 24 and three emails; a new piece is added once, then the database is the master copy; the first postcard and the three letters are removed on start-up if nothing was ever sent with them), every send or skip with the exact words (`sends`), drafts (`drafts`) and Do not contact (`flags`). Emails open the sender's own mail app and are recorded only after "Did it send?" Yes. Postcards are approved for the next mail drop; nothing mails yet (practice).


## 2026-11-25 note: doors time
The seed text in worker.js for Postcard 2 and Email 2 now says doors 6:00. The live database was updated directly (pieces postcard2 and email2), so no redeploy was needed.

- The Money Board (Nov 25, 2026): /admin/money/ reads and writes `/admin/api/money` here. It needs an eighth binding, a second D1 database named `STATS` pointing at `2g-stats` (the scoreboard's database), where the visits, leads and bookings from `assets/src.js` land, and where the Money Board keeps its tracking links (`links`), costs (`costs`) and sales (`sales`). `/admin/api/money/who?email=` finds where a buyer first came from: our own list first (by email, then by phone), then the tags GoHighLevel kept. Live version 12 (Nov 25, 2026, 4:50pm) added it; version 11 (1cef2bc6) is the one to put back if it misbehaves.

- Client pages (Nov 27, 2026): table `clients` (slug, name, emails, data as JSON, upd, by) holds one page per owner. The team reads and writes it at `/admin/api/clients` from /admin/clients/. Owners open /c/, which sits behind a second Access app ("2guysandagenie.com Client Pages", path /c, email code, anyone may sign in); `/c/api/me` returns only the page whose `emails` list has the signed-in email, with the team-only parts (team, inbox, private notes, items not started) taken out. `/c/api/ask` adds an owner's question. It needs a ninth binding, plain text `CAUD` (the second app's audience), and worker routes for `/c/api/*` on both hostnames. A save checks `upd` so two people can't overwrite each other; if the only change since was an owner's question, the question is kept and the save goes through. Live version 13 added it; version 12 (1f074d63) is the one to put back.
