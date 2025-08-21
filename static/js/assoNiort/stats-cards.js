// static/js/assoNiort/stats-cards.js

let catBarsChart = null;
let lastBarsTarget = null;     // dernière hauteur appliquée
let debouncedEq = null;        // handler debounced
let isEqualizing = false;      // lock anti-boucle
let modalOpenDepth = 0;        // nb de modals ouvertes (Bootstrap 4)

function getCssVar(name) {
  const el = document.documentElement;
  return (getComputedStyle(el).getPropertyValue(name) || '').trim();
}
function hexToRgba(hex, a = 1) {
  hex = String(hex || '').trim();
  if (!hex) return `rgba(0,0,0,${a})`;
  if (hex.startsWith('rgb')) return hex;
  if (hex[0] === '#') hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
  const n = parseInt(hex, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
function bsColor(name) {
  const v = getCssVar(`--bs-${name}`);
  if (v) return v;
  const fb = { primary:'#0d6efd', success:'#198754', warning:'#ffc107', danger:'#dc3545', info:'#0dcaf0', secondary:'#6c757d', dark:'#212529' };
  return fb[name] || fb.secondary;
}

function isAnyModalOpen() {
  // Bootstrap 4 pose .modal-open sur <body>
  return modalOpenDepth > 0 || document.body.classList.contains('modal-open');
}

// ——— sécurise l’égalisation de hauteur (évite boucles & thrash) ———
function equalizeBarsCardHeight(force = false) {
  if (isEqualizing) return;

  // Si une modal est ouverte, on ignore (sauf force)
  if (!force && isAnyModalOpen()) return;

  const stack = document.getElementById('valuesStack');
  const barsCard = document.getElementById('barsCard');
  if (!stack || !barsCard) return;

  // offsetHeight = entier → pas de dérive sub-pixel
  const h = stack.offsetHeight || Math.ceil(stack.getBoundingClientRect().height);
  const target = Math.max(260, h);

  // n’applique que si variation réelle (> 1px), sauf si force = true
  if (!force && lastBarsTarget !== null && Math.abs(target - lastBarsTarget) <= 1) {
    return;
  }

  isEqualizing = true;

  // évite de faire un style.write si identique
  const cur = parseInt((barsCard.style.height || '').replace('px',''), 10);
  if (cur !== target) {
    barsCard.style.height = `${target}px`;
    lastBarsTarget = target;
  }

  // IMPORTANT : ne pas appeler chart.resize() ici → boucles possibles
  setTimeout(() => { isEqualizing = false; }, 0);
}

// petit utilitaire debounce
function debounce(fn, ms) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// branche les recalculs (debounced) sur resize & modals
function attachResizeGuards() {
  if (!debouncedEq) debouncedEq = debounce(() => equalizeBarsCardHeight(false), 150);
  window.addEventListener('resize', debouncedEq, { passive: true });

  // Bootstrap 4 : on tracke l’ouverture/fermeture pour geler/reprendre
  if (window.jQuery) {
    const $doc = window.jQuery(document);
    $doc.on('shown.bs.modal', '.modal', () => { modalOpenDepth++; });
    $doc.on('hidden.bs.modal', '.modal', () => {
      modalOpenDepth = Math.max(0, modalOpenDepth - 1);
      // quand toutes les modals sont fermées, on égalise une seule fois (forcé)
      setTimeout(() => equalizeBarsCardHeight(true), 50);
    });
  }
}

function buildLegend(labels, perClass) {
  const legend = document.getElementById('catLegend');
  if (!legend) return;

  // Une seule ligne, plein largeur, items espacés & flex-fill
  legend.className = 'position-absolute bottom-0 start-0 end-0 small px-2 pb-1 d-flex flex-nowrap justify-content-between align-items-center gap-2 w-100';

  const esc = (s)=>String(s)
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

  legend.innerHTML = labels.map((lab,i)=>
    `<span class="badge rounded-pill text-white bg-${perClass[i]} flex-fill text-center text-truncate" style="min-width:0;">${esc(lab)}</span>`
  ).join('');
}

function renderBars(labels, perc, perClass) {
  const canvas = document.getElementById('catBars');
  if (!canvas) { setTimeout(() => equalizeBarsCardHeight(true), 0); return; }
  const ctx = canvas.getContext('2d');
  if (!ctx)  { setTimeout(() => equalizeBarsCardHeight(true), 0); return; }

  const bgColors = perClass.map(c => hexToRgba(bsColor(c), 0.85));
  const brColors = perClass.map(c => bsColor(c));

  if (catBarsChart) { try { catBarsChart.destroy(); } catch(_){} catBarsChart = null; }

  catBarsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: perc,
        backgroundColor: bgColors,
        borderColor: brColors,
        borderWidth: 1.5,
        borderRadius: 8,
        barPercentage: 0.55,
        categoryPercentage: 0.8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // le canvas remplit barsWrap
      layout: {
        // réserve bas pour UNE ligne de légende
        padding: { top: 4, right: 8, bottom: 42, left: 8 }
      },
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `${(ctx.parsed.y ?? 0).toFixed(2)} %` }
        }
      },
      scales: {
        y: {
          beginAtZero: true, max: 100,
          ticks: { callback: (v)=>`${v}%`, stepSize: 20 },
          grid: { color: getCssVar('--bs-border-color') || '#dee2e6' }
        },
        x: {
          ticks: { maxRotation: 0, minRotation: 0 },
          grid: { display: false }
        }
      }
    }
  });

  // 1er ajustement après le rendu seulement
  setTimeout(() => equalizeBarsCardHeight(true), 0);
}

// ——— API exposée globalement (appelée depuis init.js ou dashboard) ———
function buildDashCards(assos, statsMap) {
  // KPI
  if (window.jQuery) {
    window.jQuery('#countTotal').text(assos.length);
    window.jQuery('#countNoSite').text(assos.filter(a => !a.website).length);
    window.jQuery('#countNoMail').text(assos.filter(a => !a.mail).length);
  } else {
    const byId = id => document.getElementById(id);
    const setTxt = (id, v) => { const el = byId(id); if (el) el.textContent = v; };
    setTxt('countTotal', assos.length);
    setTxt('countNoSite', assos.filter(a => !a.website).length);
    setTxt('countNoMail', assos.filter(a => !a.mail).length);
  }

  // Données catégories → %
  const labels  = Object.keys(statsMap || {});
  const counts  = Object.values(statsMap || {}).map(v => Number(v) || 0);
  const total   = counts.reduce((a,b)=>a+b,0);
  const perc    = total>0 ? counts.map(v => +(v*100/total).toFixed(2)) : counts;

  // Palette Bootstrap
  const bsClasses = ['primary','success','warning','danger','info','secondary','dark'];
  const perClass  = labels.map((_,i)=> bsClasses[i % bsClasses.length]);

  // Légende + Graph
  buildLegend(labels, perClass);
  renderBars(labels, perc, perClass);

  // Guards resize/modals
  attachResizeGuards();

  // Ajuste DataTables si présent (compat legacy)
  if (typeof window.adjustVisibleTables === 'function') {
    setTimeout(window.adjustVisibleTables, 0);
  }
}

// expose en global (compat scripts non-modules)
window.buildDashCards = buildDashCards;
window.equalizeBarsCardHeight = equalizeBarsCardHeight;
