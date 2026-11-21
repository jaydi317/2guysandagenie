#!/usr/bin/env python3
"""Rebuild /admin/changes/ from the site's own git history.
Run from the repo root:  python3 tools/changes.py
Skips the hourly "Agent mail relay board update" saves. Days are Eastern time."""
import subprocess, html, datetime, zoneinfo, re
TZ = zoneinfo.ZoneInfo("America/New_York")
SKIP = re.compile(r"relay board update", re.I)
WHO = {"Claude": "Daegan's Claude", "Daegan Smith (via Claude)": "Daegan's Claude", "jaydi317": "Jimmy Davis"}
out = subprocess.run(["git", "log", "--pretty=%H%x1f%at%x1f%an%x1f%s"], capture_output=True, text=True, check=True).stdout
days, order, newest = {}, [], 0
for line in out.splitlines():
    h, t, an, s = line.split("\x1f", 3)
    if SKIP.search(s): continue
    t = int(t); newest = max(newest, t)
    d = datetime.datetime.fromtimestamp(t, TZ)
    k = d.strftime("%Y-%m-%d")
    if k not in days: days[k] = []; order.append(k)
    days[k].append((d, WHO.get(an, an), s, h))
order.sort(reverse=True)
def e(x): return html.escape(x, quote=True)
body = []
for i, k in enumerate(order):
    rows = sorted(days[k], key=lambda r: r[0], reverse=True)
    d0 = rows[0][0]
    head = d0.strftime("%A, %b ") + str(d0.day) + d0.strftime(", %Y")
    n = len(rows)
    body.append('<details class="day"%s id="d%s"><summary>%s <span class="cnt">%d change%s</span></summary><ul>' % (" open" if i < 2 else "", k, e(head), n, "" if n == 1 else "s"))
    for d, an, s, h in rows:
        tm = d.strftime("%I:%M%p").lstrip("0").lower()
        body.append('<li><span class="t">%s &middot; %s</span>%s</li>' % (tm, e(an), e(s)))
    body.append("</ul></details>")
now = datetime.datetime.now(TZ)
stamp = now.strftime("%a, %b ") + str(now.day) + now.strftime(", %Y, %I:%M%p").replace(" 0", " ").lower().replace("am", "am").replace("pm", "pm") + " Eastern"
page = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>What Changed On The Site · 2 Guys and a Genie</title>
<link rel="icon" type="image/svg+xml" href="/assets/2guys-app-icon.svg">
<style>body{margin:0;background:#fff;color:#111;font:17px/1.5 Tahoma,Geneva,Verdana,sans-serif}main{max-width:680px;margin:0 auto;padding:24px 16px 70px}
h1{font-size:30px;margin:0 0 4px}.sub{color:#555;margin:0 0 10px}a{color:#111}
details.day{border-top:3px solid #111;margin:18px 0 0;padding-top:4px}summary{font-size:20px;font-weight:bold;cursor:pointer;padding:8px 0}
.cnt{font-size:13px;font-weight:normal;color:#555;margin-left:6px}
ul{list-style:none;padding:0;margin:0}li{padding:8px 0;border-bottom:1px solid #e5e5e5}
.t{display:block;font-size:13px;color:#777}
.how{background:#FFF3C4;padding:10px 14px;margin:12px 0 4px;font-size:15px}
#new{display:none}#new h2{font-size:20px;margin:18px 0 0;border-top:3px solid #111;padding-top:10px}</style></head><body><main>
<p><a href="/admin/">&larr; Admin</a> &middot; <a href="/zoom/">Team Room</a></p>
<h1>What Changed On The Site</h1>
<p class="sub">Every change, newest first, in the words written when it was saved. Times are Eastern.</p>
<p class="how">This list was built %s. Anything saved after that shows under "Since Then" when you open the page in a browser. The hourly agent mail board saves are left out.</p>
<div id="new"><h2>Since Then</h2><ul id="newl"></ul></div>
%s
<script>
(function(){var since=%d,box=document.getElementById('new'),ul=document.getElementById('newl');
var WHO={"Claude":"Daegan's Claude","Daegan Smith (via Claude)":"Daegan's Claude","jaydi317":"Jimmy Davis"};
fetch('https://api.github.com/repos/jaydi317/2guysandagenie/commits?per_page=100&since='+new Date((since+1)*1000).toISOString()).then(function(r){return r.ok?r.json():[]}).then(function(a){
a.forEach(function(c){var m=(c.commit.message||'').split('\\n')[0];if(/relay board update/i.test(m))return;
var d=new Date(c.commit.author.date),li=document.createElement('li'),s=document.createElement('span');s.className='t';
var n=c.commit.author.name;s.textContent=d.toLocaleString('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' \\u00b7 '+(WHO[n]||n);
li.appendChild(s);li.appendChild(document.createTextNode(m));ul.appendChild(li)});
if(ul.children.length)box.style.display='block'}).catch(function(){})})();
</script>
</main></body></html>""" % (e(stamp), "\n".join(body), newest)
open("admin/changes/index.html", "w").write(page)
print(len(order), "days,", sum(len(v) for v in days.values()), "changes, newest", newest)
