/* How'd you find us: read where the visitor really came from, show that choice first and already checked,
   and fill the other three from the standing list. Used by /free15/ and /free15/start/. (Nov 20, 2026) */
(function(){
  var L={fb:'Facebook or Instagram',g:'Google',rec:'A personal recommendation',tv:'TV, radio or a podcast',
         team:'Your team reached out to me',live:'I saw you at a live event',other:'Other',mail:'An email or newsletter',ad:'An ad online',site:'Online',li:'LinkedIn',yt:'YouTube',nd:'Nextdoor',bing:'Bing',tt:'TikTok',x:'X'};
  /* Standing choices under the real source. Facebook and Google only ever show when the visitor really came from them.
     Source unknown (typed the address in): a personal recommendation leads, since word of mouth is the one we can't read. */
  var POOL=['live','tv','other'];
  function detect(){
    var q=new URLSearchParams(location.search), us=(q.get('utm_source')||'').toLowerCase(), src=(q.get('src')||'').toLowerCase(), h='';
    try{ if(document.referrer) h=new URL(document.referrer).hostname.toLowerCase(); }catch(e){}
    if(h.indexOf('2guysandagenie.com')>-1) h='';
    if(q.get('fbclid')||/facebook|instagram|^fb$|^ig$|meta/.test(us)||/facebook\.|instagram\.|fb\.com|fb\.me/.test(h)) return 'fb';
    if(q.get('gclid')||q.get('gbraid')||q.get('wbraid')||/google/.test(us)||/google\./.test(h)) return 'g';
    if(/^group-/.test(src)||/^(friend|share|ref|referral)/.test(src)||/referral|friend/.test(us)) return 'rec';
    if(/^(team|vm|voicemail|slydial|card|mail|letter|walkin)/.test(src)) return 'team';
    if(/linkedin\.|lnkd\.in/.test(h)||/linkedin/.test(us)) return 'li';
    if(/youtube\.|youtu\.be/.test(h)||/youtube/.test(us)) return 'yt';
    if(/nextdoor\./.test(h)||/nextdoor/.test(us)) return 'nd';
    if(/bing\./.test(h)) return 'bing';
    if(/tiktok\./.test(h)||/tiktok/.test(us)) return 'tt';
    if(/(^|\.)x\.com$|twitter\.|t\.co$/.test(h)) return 'x';
    var um=(q.get('utm_medium')||'').toLowerCase();
    if(/email|newsletter/.test(um)||/newsletter|email|substack|beehiiv|mailchimp/.test(us)||/substack\.|beehiiv\./.test(h)) return 'mail';
    if(/banner|display|cpc|paid|ad/.test(um)) return 'ad';
    if(h) return 'site';
    return '';
  }
  /* The real facts, kept no matter which choice they tap: the site they were on and any tags on the link. */
  function facts(){ var q=new URLSearchParams(location.search),o={},h=''; try{ if(document.referrer) h=new URL(document.referrer).hostname.toLowerCase(); }catch(e){}
    if(h&&h.indexOf('2guysandagenie.com')<0) o.site=h; ['src','utm_source','utm_medium','utm_campaign'].forEach(function(k){ if(q.get(k)) o[k]=q.get(k); });
    ['fbclid','gclid'].forEach(function(k){ if(q.get(k)) o[k]='yes'; }); return o; }
  var s='';
  var real={};
  try{ s=detect(); real=facts(); if(s){ sessionStorage.setItem('found_src',s); sessionStorage.setItem('found_real',JSON.stringify(real)); } else { s=sessionStorage.getItem('found_src')||''; real=JSON.parse(sessionStorage.getItem('found_real')||'{}'); } }catch(e){ s=s||''; }
  if(!L[s]) s='';
  function list(){ return s ? [s].concat(POOL) : ['rec','live','tv','site']; }
  /* The four change with how they arrived. A source we can read leads, checked (an unrecognized site reads as Online).
     Came direct, nothing to read: nothing is checked, and a recommendation is one of the four. */
  var realKey=s||'unknown';
  window.Found={src:s,realKey:realKey,real:real,label:function(k){return L[k]||''},list:list};
})();
