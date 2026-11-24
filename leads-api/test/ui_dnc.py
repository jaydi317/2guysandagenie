from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome'); c=b.new_context(viewport={'width':390,'height':844}); c.add_cookies([{'name':'who','value':'Paul','url':'http://localhost:8788'}])
    pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept('test reason'))
    pg.goto('http://localhost:8788/admin/leads/#lead=T3'); pg.wait_for_timeout(1200)
    pg.click('#dncb'); pg.wait_for_timeout(1200); m=pg.locator('#dnc-msg').inner_text()
    print(('PASS ' if 'GoHighLevel' in m and pg.locator('#dnc-msg').is_visible() else 'FAIL ')+'Do not contact says what happened: '+m)
    pg.click('#dncb'); pg.wait_for_timeout(1200); m=pg.locator('#dnc-msg').inner_text()
    print(('PASS ' if 'is off' in m else 'FAIL ')+'taking it off says so: '+m)
    print(('PASS ' if not errs else 'FAIL ')+'no page errors '+str(errs[:2])); b.close()
