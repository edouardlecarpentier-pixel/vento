/* Sections dépliables : un clic sur le titre d'une carte l'ouvre ou la ferme. L'état est mémorisé par carte.
   VFold.init(cartes, { key, closed:[titres fermés par défaut], minWidth }) — en dessous de minWidth (px), les cartes restent ouvertes. */
const VFold = (() => {
  let css = false;
  function style(minWidth) {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `@media (min-width:${minWidth}px){
      .fold-h{cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent}
      .fold-h::after{content:'▾';flex:none;margin-left:6px;font-size:15px;line-height:1;opacity:.8;transition:transform .18s}
      .fold-h:focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:6px}
      .card.fold-closed>:not(h2){display:none!important}
      .card.fold-closed>h2{margin-bottom:0}
      .card.fold-closed>h2.fold-h::after{transform:rotate(-90deg)}
    }`;
    document.head.append(s);
  }
  const titleOf = c => (c.querySelector('h2 > span')?.textContent || c.id || '').trim();
  function init(cards, { key = 'vento.fold', closed = [], minWidth = 0 } = {}) {
    style(minWidth);
    let st = {}; try { st = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
    const save = () => { try { localStorage.setItem(key, JSON.stringify(st)); } catch {} };
    const mq = matchMedia(`(min-width:${minWidth}px)`);
    cards.forEach(card => {
      const h = card.querySelector(':scope > h2'); if (!h) return;
      const name = titleOf(card), isClosed = () => name in st ? !st[name] : closed.some(t => name.includes(t));
      const apply = () => { const c = isClosed(); card.classList.toggle('fold-closed', c); h.setAttribute('aria-expanded', String(!c)); };
      h.classList.add('fold-h'); h.setAttribute('role', 'button'); h.tabIndex = 0; apply();
      const toggle = () => { if (!mq.matches) return; st[name] = isClosed(); save(); apply(); dispatchEvent(new Event('resize')); };   // « resize » : les graphiques se redessinent
      h.addEventListener('click', e => { if (e.target.closest('a,button,input,select,label')) return; toggle(); });
      h.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === h) { e.preventDefault(); toggle(); } });
    });
  }
  return { init };
})();
