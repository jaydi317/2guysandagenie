# The lead portal's shared record

`worker.js` is the Cloudflare Worker `2g-leads`. It sits between the lead portal (/admin/leads/), a private database (Cloudflare D1, `2g-leads`) and GoHighLevel.

- The site's code is public, so no shop is ever named in these files. The records live in the database.
- Everything under /admin/api/ is behind the Admin sign-in (Cloudflare Access: Daegan, Jimmy, Paul).
- Each tap in the portal is saved with who made it, so all three see the same record.
- Once the Worker has a GoHighLevel key (`GHL_TOKEN`), each tap also moves the shop's deal card in the "Local Leads (Lead Portal)" pipeline and adds a note to the contact, and stage changes made in GoHighLevel come back within a few minutes.
- `/hooks/ghl?key=...` is where GoHighLevel can tell the portal something happened (a sign-up, a booked call).

To change it: edit `worker.js`, then redeploy the Worker in Cloudflare (Workers, 2g-leads). Settings that are not in this file: `AUD`, `TEAM`, `GHL_CFG` (plain), and `DATA_KEY`, `HOOK_KEY`, `GHL_TOKEN` (secret).
- Mail and email (Nov 23): the database also holds the seven pieces' master words (table `pieces`, filled once from Draft 6, then the database is the master copy), every send or skip with the exact words (`sends`), drafts (`drafts`) and Do not contact (`flags`). Emails open the sender's own mail app and are recorded only after "Did it send?" Yes. Postcards and letters are approved for the next mail drop; nothing mails yet (practice).
