# Testing The Leads Portal Locally

A stand-in for Cloudflare: the real worker.js on a local SQLite database, a test sign-in, and made-up shops only (never real ones). Needs Node 22+ and Python with Playwright.

Start it on a fresh database, then seed it:

    cd leads-api/test
    python3 seed.py t.db
    node server.mjs ../.. 8788 t.db        # add GHL=1 in front to switch on a pretend GoHighLevel

Open http://localhost:8788/admin/leads/ with a cookie `who=Paul` (or Jimmy, Daegan).

Tests (each wants its own fresh database and the server on 8788; ui_order.py starts its own):
ui_order.py (calls and emails in order), ui_take.py and ui_real.py (run the server with GHL=1), ui_dnc.py.
