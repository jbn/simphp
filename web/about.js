/*
 * The About modal ("A Candle in the Dark"), shared by both pages. It opens by
 * itself on a visitor's first load and from any #btn-about afterwards.
 * Styles live in style.css (.about-*).
 */
(function () {
  'use strict';

  const SEEN_KEY = 'simphp.about.seen';

  const HTML = `
<dialog id="about" class="about" aria-labelledby="about-title">
  <div class="about-card">
    <svg class="about-candle" viewBox="0 0 80 120" aria-hidden="true">
      <defs>
        <radialGradient id="about-glow"><stop offset="0" stop-color="#ffcf6b" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf6b" stop-opacity="0"/></radialGradient>
        <linearGradient id="about-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff4c2"/><stop offset=".45" stop-color="#ffc24a"/><stop offset="1" stop-color="#e2571c"/></linearGradient>
        <linearGradient id="about-wax" x1="0" x2="1"><stop offset="0" stop-color="#e9dcc0"/><stop offset=".55" stop-color="#fbf4e2"/><stop offset="1" stop-color="#d8c7a3"/></linearGradient>
      </defs>
      <circle class="about-halo" cx="40" cy="34" r="34" fill="url(#about-glow)"/>
      <g class="about-fire"><path d="M40 12c6 9 9 15 9 21a9 9 0 0 1-18 0c0-6 3-12 9-21z" fill="url(#about-flame)"/><path d="M40 27c2.5 3.5 3.5 6 3.5 8a3.5 3.5 0 0 1-7 0c0-2 1-4.5 3.5-8z" fill="#fffbe8"/></g>
      <path d="M40 41v7" stroke="#3b2f22" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M26 50h28v58H26z" fill="url(#about-wax)"/>
      <path d="M26 50h28v5c-3 0-3 9-6 9s-2-7-5-7-3 13-6 13-2-11-5-11-3 4-6 4z" fill="#fbf4e2"/>
      <path d="M14 108h52a4 4 0 0 1 0 8H14a4 4 0 0 1 0-8z" fill="#8a5a2b"/>
    </svg>
    <p class="about-kicker">From the Archive &middot; Exhibit N&ordm; 4.1.1</p>
    <h2 id="about-title">A Candle in the Dark</h2>
    <div class="about-rule" aria-hidden="true"><span>&#10086;</span></div>
    <div class="about-text">
      <p>Once upon a time, people used to write computer programs carefully by hand. One of the languages that helped translate human-to-machine was called PHP. It was invented by Mark Zuckerberg so that he could connect the world for Great Good.</p>
      <p>PHP was a beautiful language. It combined the perfect syntax of programming languages like Perl with the power of goto statements.</p>
      <p>Widely respected as one of the most important programming languages to ever exist, PHP is now but a memory. But, we digital archeologists maintain copies of it, so that the ancient knowledge is not lost &mdash; a candle in the dark.</p>
    </div>
    <p class="about-provenance">Specimen: PHP 4.1.1 &middot; Zend Engine 1.1.1 &middot; December 2001<br>Preserved in WebAssembly. It runs entirely in your browser. &middot; <a class="about-source" href="https://github.com/jbn/simphp" target="_blank" rel="noopener">field notes</a></p>
    <form method="dialog" class="about-actions">
      <button class="about-enter" value="enter" autofocus>Enter the archive</button>
    </form>
    <form method="dialog"><button class="about-close" value="close" title="Close" aria-label="Close">&times;</button></form>
  </div>
</dialog>`;

  function init() {
    document.head.insertAdjacentHTML('beforeend',
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap">');
    document.body.insertAdjacentHTML('beforeend', HTML);
    const dlg = document.getElementById('about');
    const open = () => {
      if (dlg.open) return;
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    };
    dlg.addEventListener('close', () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* ignore */ } });
    // a click on the backdrop (outside the card) closes it
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.querySelectorAll('#btn-about').forEach((b) => b.addEventListener('click', open));
    let seen = false;
    try { seen = !!localStorage.getItem(SEEN_KEY); } catch (e) { seen = true; /* no storage: don't nag every load */ }
    if (!seen) open();
    window.SimAbout = { open };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
