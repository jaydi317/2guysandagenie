'use strict';
// One source component, byte-identical on both sites.
const storyAssetBase=new URL('.',document.currentScript.src).href;
class ClientStories extends HTMLElement{
  connectedCallback(){
    if(this.dataset.rendered)return;
    this.dataset.rendered='true';
    this.innerHTML=`
    <article class="case-study genie-case" aria-label="Jack of All Trades case study">
      <div class="case-top"><div><p class="muted">The Jack of All Trades</p><h3 class="case-title">Jamon Jack and his son, Chase.</h3><p>A new name people remember: <a href="https://gottacalljack.com" target="_blank" rel="noopener">gottacalljack.com</a></p></div><div><p>A new brand and a new website</p></div></div>
      <figure class="case-image"><div class="compare-labels"><span>Before · tjoat.net<br>Supplied website snapshot</span><span>Website built · gottacalljack.com<br>Supplied redesign snapshot</span></div><a href="${storyAssetBase}jack-before-after-stacked.png" target="_blank" rel="noopener" aria-label="Open the supplied Jack website comparison at full size"><img src="${storyAssetBase}jack-before-after-stacked.png" alt="Supplied comparison of the old Jack of All Trades website and the new website design" loading="eager"></a></figure>
      <h4>What we did</h4>
      <ul class="scope"><li><strong>Name</strong><br>gottacalljack.com</li><li><strong>Brand + website</strong><br>A new brand and a new website</li></ul>
      <h4>What happened next</h4>
      <p>Jamon and Chase did their TV commercials, radio spots and a jingle on their own.</p>
      <blockquote>“My son's business is so busy right now. We have to literally grow.”<cite>Jamon Jack · His own words, from the supplied testimonial</cite></blockquote>
    </article>`;
  }
}
customElements.define('client-stories',ClientStories);
