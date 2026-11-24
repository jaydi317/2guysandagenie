import subprocess,time,sys
from playwright.sync_api import sync_playwright
srv=subprocess.Popen(['node','server.mjs','../..','8788','o.db'],stdout=open('o.log','w'),stderr=subprocess.STDOUT)
time.sleep(1.5); subprocess.run(['python3','seed.py','o.db'],check=False)
ok=lambda c,m:print(('PASS ' if c else 'FAIL ')+m)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(channel='chrome'); c=b.new_context(viewport={'width':390,'height':844}); c.add_cookies([{'name':'who','value':'Paul','url':'http://localhost:8788'}])
  pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto('http://localhost:8788/admin/leads/#lead=T1'); pg.wait_for_timeout(1800)
  links=pg.locator('#nextbox a, .next a').all_inner_texts() if pg.locator('.next a').count() else []
  body=pg.inner_text('body')
  ok(body.find('Phone Script')<body.find('If No One Answers: The Message') and body.find('If No One Answers')>0,'phone script shows before the message')
  seq=pg.locator('.pseq'); ok(seq.count()==3,'three emails shown in order: '+str(seq.count()))
  t=[seq.nth(k).inner_text() for k in range(seq.count())]
  ok('1 of 3' in t[0] and 'Make It Personal And Send' in t[0] and 'Subject:' in t[0],'email 1 shows its words and the send button')
  ok('Unlocks after Email 1 is sent' in t[1] and 'Make It Personal' not in t[1] and 'Subject:' in t[1],'email 2 shows its words, locked')
  ok('Unlocks after Email 2 is sent' in t[2],'email 3 waits on email 2')
  pg.screenshot(path='shots/order-T1.png',full_page=True)
  pg.goto('http://localhost:8788/admin/leads/#lead=T2'); pg.wait_for_timeout(1500)
  seq=pg.locator('.pseq'); t=[seq.nth(k).inner_text() for k in range(seq.count())]
  ok('Locked until we have their email' in t[0] and 'Subject:' in t[0],'no-email shop: email 1 readable, says how it opens')
  ok(seq.count()==3,'no-email shop shows all three')
  top=pg.inner_text('#pcnext'); ok('so the emails are locked' in top and 'Find Their Email' in top,'no-email box reads like a person: '+top.replace(chr(10),' | '))
  ok(pg.locator('#pcnext a').get_attribute('href').startswith('https://www.google.com/search'),'the box link looks their email up')
  ok('They unlock in order' in pg.inner_text('#pcall-s'),'line above the emails says when Email 1 unlocks')
  ok('rgb(242, 210, 122)' in pg.eval_on_selector('#find','e=>getComputedStyle(e).backgroundColor'),'Find Their Email is gold')
  pg.locator('#pcnext').scroll_into_view_if_needed(); pg.screenshot(path='shots/noemail.png')
  # send email 1 (record it), then email 2 should open and email 3 wait on it
  pg.goto('http://localhost:8788/admin/leads/#lead=T1'); pg.wait_for_timeout(1500)
  r=pg.evaluate("fetch('/admin/api/act',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({op:'piece',id:'T1',pid:'email1',st:'sent',subj:'s',body:'b'})}).then(r=>r.status)")
  pg.reload(); pg.wait_for_timeout(1800); seq=pg.locator('.pseq'); t=[seq.nth(k).inner_text() for k in range(seq.count())]
  ok('Make It Personal And Send' in t[1] and 'Unlocks after Email 2' in t[2] and 'See what went' in t[0],'after email 1 goes, email 2 opens ('+str(r)+')')
  ok(not errs,'no page errors '+str(errs[:2])); b.close()
finally: srv.terminate()
