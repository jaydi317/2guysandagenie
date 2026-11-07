/* Before-and-after window for the client tiles. A tile with data-ba opens the window; a tile with data-url jumps there instead. */
(function(){
  var BA='/assets/before-after/';
  var m=document.getElementById('ba-modal');if(!m)return;
  var t=document.getElementById('ba-title'),b=document.getElementById('ba-before'),a=document.getElementById('ba-after'),s=document.getElementById('ba-site');
  function close(){m.hidden=true;b.removeAttribute('src');a.removeAttribute('src');document.body.style.overflow='';}
  document.querySelectorAll('[data-ba],[data-url]').forEach(function(el){el.addEventListener('click',function(e){
    var u=el.getAttribute('data-url');
    if(u){e.preventDefault();
      if(u.charAt(0)==='#'){var x=document.getElementById(u.slice(1));if(x)x.scrollIntoView({behavior:'smooth',block:'center'});}
      else{location.href=u;}
      return;}
    e.preventDefault();
    var k=el.getAttribute('data-ba'),n=el.getAttribute('data-name');
    t.textContent=n;b.src=BA+k+'-before.jpg';a.src=BA+k+'-after.jpg';b.alt=n+', before';a.alt=n+', after';
    s.href=el.getAttribute('data-site');m.hidden=false;document.body.style.overflow='hidden';
  });});
  document.getElementById('ba-close').addEventListener('click',close);
  m.addEventListener('click',function(e){if(e.target===m)close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!m.hidden)close();});
})();
