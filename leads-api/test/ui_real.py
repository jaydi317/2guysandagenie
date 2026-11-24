import json,urllib.request
from playwright.sync_api import sync_playwright
ghl=lambda: len(json.load(urllib.request.urlopen('http://localhost:8788/_ghl')))
ok=bad=0
def t(n,c):
    global ok,bad; print(('PASS ' if c else 'FAIL ')+n); ok+=bool(c); bad+=(not c)
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome'); c=b.new_context(viewport={'width':390,'height':844}); c.add_cookies([{'name':'who','value':'Jimmy','url':'http://localhost:8788'}])
    pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8788/admin/leads/'); pg.wait_for_timeout(1200)  # leaves yesterday's saved copy
    pg.evaluate("sessionStorage.setItem('2g-practice','1')"); pg.goto('http://localhost:8788/admin/leads/#lead=T2'); pg.reload(); pg.wait_for_timeout(1200)
    n=ghl(); pg.locator('#claim').click(); pg.wait_for_timeout(600)
    t('Practice mode: taking a shop sends nothing to GoHighLevel',ghl()==n)
    t('Practice mode: no GoHighLevel line under the button',pg.locator('#wk-msg').inner_text()=='')
    pg.fill('#em','try@example.com'); pg.click('#em-save'); pg.wait_for_timeout(600)
    t('Practice mode: email save says NOT saved and sends nothing',ghl()==n and 'NOT saved' in pg.locator('#em-msg').inner_text())
    pg.locator('.pmstop').first.click(); pg.wait_for_timeout(1200)
    pg.goto('http://localhost:8788/admin/leads/#lead=T2'); pg.wait_for_timeout(1000)
    n=ghl(); pg.fill('#em','jimmy-found@example.com'); pg.click('#em-save'); pg.wait_for_timeout(1000)
    t('after Stop practicing, Jimmy saves for real and it reaches GoHighLevel: '+pg.locator('#em-msg').inner_text(),ghl()>n and 'GoHighLevel too' in pg.locator('#em-msg').inner_text())
    t('the write-your-own line shows under the button',pg.locator('#mail-sub').is_visible())
    pg.screenshot(path='shots/14-jimmy-real.png')
    t('no page errors '+str(errs[:2]),not errs)
    b.close()
print(ok,'pass',bad,'fail')
