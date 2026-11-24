# Made-up shops only. Never real ones.
import sqlite3,sys,time
db=sqlite3.connect(sys.argv[1]);now=int(time.time()*1000)
rows=[('T1','A','Maple Street Bakery (made up)','Bakery','Fishers','100 Fake St, Fishers, IN 46038','317-555-0101','https://example.com','owner@example.com',4.6,80,1.2,'Test shop with an email.','Test finding: their contact form is broken.','Test','Not touched yet',''),
('T2','A','Fake Plumbing Co (made up)','Plumber','Carmel','200 Pretend Ave, Carmel, IN 46032','317-555-0102','', '',4.1,20,4.0,'Test shop, no email.','','Test','Not touched yet',''),
('T3','B','Pretend Dental (made up)','Dentist','Fishers','','317-555-0103','','frontdesk@example.org',4.9,300,2.0,'Test shop, no address.','','Test','Talked to the owner',''),
('T4','B','Sample Law Office (made up)','Lawyer','Carmel','300 Sample Rd, Carmel, IN 46032','317-555-0104','','law@example.net',4.0,10,5.0,'Test shop Jimmy is working.','','Test','Not touched yet','Jimmy')]
db.execute('CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, g TEXT, n TEXT, k TEXT, t TEXT, a TEXT, p TEXT, u TEXT, e TEXT, rt REAL, rv INTEGER, mi REAL, w TEXT, f TEXT, src TEXT, custom INTEGER DEFAULT 0, st TEXT, wk TEXT, note TEXT, gc TEXT, go TEXT, gs TEXT, gn TEXT, upd INTEGER)')
for r in rows: db.execute('INSERT OR REPLACE INTO leads (id,g,n,k,t,a,p,u,e,rt,rv,mi,w,f,src,st,wk,upd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',r+(now,))
for i in ['T1','T2','T3']: db.execute("UPDATE leads SET gc=?, go=?, gs='S0' WHERE id=?",('gc'+i,'go'+i,i))
db.execute("UPDATE leads SET gc='theirsT4', go='goT4', gs='S0' WHERE id='T4'")
db.commit();print('seeded',len(rows))
