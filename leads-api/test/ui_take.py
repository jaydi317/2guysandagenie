import json,urllib.request
from playwright.sync_api import sync_playwright
ghl=lambda: json.load(urllib.request.urlopen('http://localhost:8788/_ghl'))
ok=bad=0
def t(n,c):
    global ok,bad; print(('PASS ' if c else 'FAIL ')+n); ok+=bool(c); bad+=(not c)
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome'); c=b.new_context(viewport={'width':390,'height':844}); c.add_cookies([{'name':'who','value':'Paul','url':'http://localhost:8788'}])
    pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8788/admin/leads/'); pg.wait_for_timeout(1200)
    t('no Give me 5 button','Give me 5' not in pg.content())
    boxes=pg.locator('#rows .pk input'); n=boxes.count()
    t('open shops have a box in the list: '+str(n),n>=1)
    t('Take bar hidden until something is ticked',not pg.locator('#takebar').is_visible())
    boxes.nth(0).check(); 
    if n>1: boxes.nth(1).check()
    t('Take bar shows the count: '+pg.locator('#take').inner_text(),pg.locator('#takebar').is_visible() and ('2 shops' in pg.locator('#take').inner_text() or n==1))
    pg.screenshot(path='shots/15-take-bar.png')
    k=len(ghl()); pg.click('#take'); pg.wait_for_timeout(2500)
    m=pg.locator('#status').inner_text(); t('after Take: '+m,'You took' in m)
    t('ticked shops now show as Paul\'s and assigned in GoHighLevel',any((x['body'] or {}).get('assignedTo')=='uP' for x in ghl()[k:]))
    t('Take bar gone after taking',not pg.locator('#takebar').is_visible())
    t('shops Paul now has have no box',pg.locator('#rows .pk input').count()==max(n-2,0) or pg.locator('#rows .pk input').count()==n-min(n,2))
    pg.locator('#rows button.lead').first.click(); pg.wait_for_timeout(600)
    t('Take bar not on a shop page',not pg.locator('#takebar').is_visible())
    t('no page errors '+str(errs[:2]),not errs)
    b.close()
print(ok,'pass',bad,'fail')
