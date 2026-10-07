
'use strict';
// Keep the existing src/utm_* transfer and adapt GHL's standard Source key.
function passTracking(iframe){
  const source=iframe.getAttribute('src');if(!source||source==='about:blank')return;
  const target=new URL(source,location.href);
  for(const [key,value] of new URLSearchParams(location.search)){
    if(key==='src'||key.startsWith('utm_'))target.searchParams.set(key,value);
    if(key==='src')target.searchParams.set('source',value);
  }
  if(target.href!==iframe.src)iframe.src=target.href;
}
function wireForms(){document.querySelectorAll('#ghl-slot iframe,iframe[data-ghl-form]').forEach(passTracking)}
wireForms();
const slot=document.getElementById('ghl-slot');
if(slot)new MutationObserver(wireForms).observe(slot,{childList:true,subtree:true});
document.querySelectorAll('.video-player').forEach(player=>{
  const cover=player.querySelector('.video-cover'),video=player.querySelector('video');
  cover.addEventListener('click',async()=>{
    video.controls=true;cover.hidden=true;player.classList.add('playing');
    try{await video.play()}catch{cover.hidden=false;player.classList.remove('playing')}
  });
});
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
  const status=document.querySelector('.copy-status');
  try{await navigator.clipboard.writeText(button.dataset.copy);status.textContent='Copied. Ready to share.'}
  catch{status.textContent=button.dataset.copy}
}));
