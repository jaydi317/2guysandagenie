/* How'd you find us: read where the visitor really came from, show that choice first and already checked,
   and fill the other three from the standing list. Used by /free15/ and /free15/start/. (Nov 20, 2026) */
(function(){
  var L={fb:'Facebook or Instagram',g:'Google',rec:'A personal recommendation',tv:'TV, radio or a podcast',
         team:'Your team reached out to me',li:'LinkedIn',yt:'YouTube',nd:'Nextdoor',bing:'Bing',tt:'TikTok',x:'X'};
  var POOL=['fb','g','rec','tv'];
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
    return '';
  }
  var s='';
  try{ s=detect(); if(s) sessionStorage.setItem('found_src',s); else s=sessionStorage.getItem('found_src')||''; }catch(e){ s=s||''; }
  if(!L[s]) s='';
  function list(){ var out=s?[s]:[]; POOL.forEach(function(k){ if(out.length<4&&out.indexOf(k)<0) out.push(k); }); return out; }
  window.Found={src:s,label:function(k){return L[k]||''},list:list};
})();
