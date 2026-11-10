/* The next live night. ONE place to set the date for every page.
   While NEXT_EVENT is null, pages say "Next date coming soon" and hide the calendar buttons.
   When the date is set, fill this in, e.g.:
   window.NEXT_EVENT = {
     long:  "Monday, December 14",          // "When:" lines
     short: "Mon Dec 14",                   // small labels and kickers
     num:   "14", mon: "DEC", day: "MONDAY", // the ticket stub
     gcal:  "20261215T000000Z/20261215T020000Z" // Google Calendar UTC start/end
   };
*/
window.NEXT_EVENT = null;
(function(){
  var st=document.createElement('style'); st.textContent='[data-ev-show][hidden]{display:none!important}'; (document.head||document.documentElement).appendChild(st);
  function run(){
    var e = window.NEXT_EVENT; if(!e) return;
    document.querySelectorAll('[data-ev]').forEach(function(el){ var k=el.getAttribute('data-ev'); if(e[k]) el.textContent=e[k]; });
    document.querySelectorAll('[data-ev-show]').forEach(function(el){ el.hidden=false; el.style.display=''; });
    if(e.gcal) document.querySelectorAll('a[data-ev-gcal]').forEach(function(a){ a.href=a.href.replace(/dates=[^&]*/,'dates='+encodeURIComponent(e.gcal)); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
})();
