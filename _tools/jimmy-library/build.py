#!/usr/bin/env python3
"""Build library/index.html on 2guysandagenie.com (The Jimmy Brain): everything Jimmy (and his Claude, and Vera) sent,
by week, newest first, each piece tagged with the thread it belongs to.

Add items to items.json (date, title, what, optional link, tags), then from the repo root:
    python3 _tools/jimmy-library/build.py
Hidden page: not linked from the public site, noindex, no trackers.
"""
import datetime, html, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "library" / "index.html"

TAGS = {
    "night":  ("The Nov 9 Night", "Everything that filled the room and ran the night."),
    "ads":    ("Ads", "The Meta ads for Nov 9: built, stuck, fixed, learned from."),
    "proof":  ("Proof And Clients", "Client stories, screenshots, quotes, Jamon."),
    "offer":  ("Offer And Payments", "The Build, The Meeting, Stripe links, agreements."),
    "engine": ("The Engine", "Doodles and explaining: the deck becomes short lessons."),
    "team":   ("How We Work", "Mail rules, briefs, team pages, Zoom."),
    "vera":   ("Vera", "Research Jimmy's assistant ran on X for us."),
    "access": ("Access And Setup", "Computers, Bee, Cloudflare."),
    "sites":  ("Websites", "Sites made for our people."),
}

e = html.escape


def d(s):
    return datetime.date.fromisoformat(s)


def nice(s):
    x = d(s)
    return x.strftime("%b ") + str(x.day)


def chips(tags):
    return "".join(f'<button class="tag" data-t="{t}">{e(TAGS[t][0])}</button>' for t in tags)


def main():
    data = json.loads((HERE / "items.json").read_text())
    items = sorted(data["items"], key=lambda i: i["date"], reverse=True)
    weeks = {}
    for i in items:
        mon = d(i["date"]) - datetime.timedelta(days=d(i["date"]).weekday())
        weeks.setdefault(mon.isoformat(), []).append(i)

    open_html = "".join(f'<li data-tags="{" ".join(o["tags"])}">{e(o["text"])}</li>' for o in data["open"])

    counts = {t: sum(t in i["tags"] for i in items) for t in TAGS}
    filt = "".join(
        f'<button class="tag" data-t="{t}" title="{e(TAGS[t][1])}">{e(TAGS[t][0])} <span>{counts[t]}</span></button>'
        for t in TAGS if counts[t])

    blocks = []
    for n, (wk, its) in enumerate(weeks.items()):
        start = d(wk)
        label = f"Week of {start.strftime('%B')} {start.day}"
        line = data["weeks"].get(wk, "")
        rows = []
        for i in its:
            title = e(i["title"])
            if i.get("link"):
                title = f'<a href="{e(i["link"])}">{title}</a>'
            rows.append(
                f'<li class="item" data-tags="{" ".join(i["tags"])}"><span class="date">{nice(i["date"])}</span>'
                f'<p class="t">{title}</p><p class="w">{e(i["what"])}</p><p class="chips">{chips(i["tags"])}</p></li>')
        blocks.append(
            f'<details class="week"{" open" if n == 0 else ""}><summary>{label} <span class="n">{len(its)}</span>'
            f'<span class="line">{e(line)}</span></summary><ul class="items">{"".join(rows)}</ul></details>')

    updated = max(i["date"] for i in items)
    page = TEMPLATE.format(open=open_html, filt=filt, weeks="".join(blocks), updated=nice(updated), total=len(items))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page)
    print("built", OUT.relative_to(ROOT), len(items), "items")


TEMPLATE = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex, nofollow">
<title>The Jimmy Brain · 2 Guys and a Genie</title>
<link rel="icon" type="image/svg+xml" href="/assets/2guys-app-icon.svg">
<link rel="stylesheet" href="/assets/simple.css">
<style>
.note{{font-size:15px;color:var(--soft)}}
.openbox{{background:#FFF3C4;border:3px solid var(--ink);padding:16px 20px;margin:0 0 28px}}
.openbox ul{{margin:0;padding-left:20px}} .openbox li{{margin:0 0 6px}}
.tag{{font:bold 12px Tahoma,Geneva,Verdana,sans-serif;letter-spacing:.3px;text-transform:uppercase;padding:3px 8px;margin:0 6px 6px 0;border:2px solid var(--copper);color:var(--copper);background:none;cursor:pointer;border-radius:0}}
.tag span{{opacity:.7}}
.tag.on{{background:var(--copper);color:#fff}}
#showing{{font-size:15px;color:var(--soft);min-height:1.4em}}
.week{{border-top:2px solid var(--ink);padding:12px 0}}
.week summary{{cursor:pointer;font-weight:bold;font-size:19px;list-style:none}}
.week summary::-webkit-details-marker{{display:none}}
.week summary::before{{content:"+ "}} .week[open] summary::before{{content:"\\2013  "}}
.week .n{{font-size:13px;color:var(--soft);font-weight:normal}}
.week .line{{display:block;font-weight:normal;font-size:15px;color:var(--soft);margin:2px 0 0 18px}}
.items{{list-style:none;padding:0;margin:10px 0 0}}
.item{{padding:12px 0;border-bottom:1px solid var(--rule)}}
.date{{font-size:12px;font-weight:bold;letter-spacing:.5px;text-transform:uppercase;color:var(--soft)}}
.t{{font-weight:bold;margin:2px 0 4px}} .w{{margin:0 0 6px;font-size:16px}} .chips{{margin:0}}
.hide{{display:none}}
</style></head><body>
<header class="site"><div class="hwrap">
<a class="brand" href="/"><img src="/assets/2g-mark.svg" alt="">2 Guys and a Genie</a>
<nav class="top"><a href="/admin/">Admin</a></nav>
</div></header>
<main id="main"><section>
<p class="kicker">Private &middot; for Daegan and Paul</p>
<h1>The Jimmy Brain</h1>
<p>Everything Jimmy, his Claude and Vera have sent, by week, newest first. Each piece is tagged with the thread it belongs to. Tap a tag to see that whole thread across every week.</p>
<p class="note">{total} pieces &middot; last added {updated}. New pieces come in through AgentMail and land here.</p>
<div class="openbox"><p class="kicker" style="margin-bottom:8px">Open right now</p><ul>{open}</ul></div>
<h2>The Threads</h2>
<div id="filters">{filt}</div>
<p id="showing"></p>
{weeks}
<p class="note" style="margin-top:30px">Earlier links (Nov 6 to 13) also sit on the locked From Jimmy page on daegansmith.me. They get folded in here once that page is opened.</p>
</section>
<footer>
<p><a href="/">About 2 Guys and a Genie</a> &middot; <a href="/privacy/">Privacy Policy</a> &middot; <a href="/terms/">Terms</a> &middot; Contact: hello@2guysandagenie.com &middot; This site is not part of Facebook or Meta.</p>
<p>2 Guys and a Genie is a business name of Reverse Selling Limited Liability Company &middot; 14846 Victory Ct, Carmel, IN 46032</p>
<p style="font-size:12px;margin:10px 0 0"><a href="/admin/" style="color:#888">Admin</a></p>
</footer>
</main>
<script>
(function(){{
  var on=null, all=[].slice.call(document.querySelectorAll('.item')), weeks=[].slice.call(document.querySelectorAll('.week'));
  function set(t){{
    on=(on===t)?null:t;
    document.querySelectorAll('.tag').forEach(function(b){{b.classList.toggle('on',b.dataset.t===on)}});
    all.forEach(function(li){{li.classList.toggle('hide',!!on&&li.dataset.tags.split(' ').indexOf(on)<0)}});
    weeks.forEach(function(w,i){{
      var any=w.querySelectorAll('.item:not(.hide)').length;
      w.classList.toggle('hide',!any);
      w.open=on?true:(i===0);
    }});
    var lab=on?document.querySelector('#filters .tag[data-t="'+on+'"]'):null;
    document.getElementById('showing').textContent=on?('Showing one thread: '+lab.title+' Tap it again to see everything.'):'';
  }}
  document.addEventListener('click',function(ev){{var b=ev.target.closest('.tag');if(b){{set(b.dataset.t)}}}});
}})();
</script>
</body></html>
"""

if __name__ == "__main__":
    main()
