// static/js/assoNiort/stats-cards.js

let catBarsChart = null;

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
  const fb = {
    primary:   '#0d6efd',
    success:   '#198754',
    warning:   '#ffc107',
    danger:    '#dc3545',
    info:      '#0dcaf0',
    secondary: '#6c757d',
    dark:      '#212529'
  };
  return fb[name] || fb.secondary;
}

function equalizeBarsCardHeight() {
  const stack = document.getElementById('valuesStack');
  const barsCard = document.getElementById('barsCard');
  if (!stack || !barsCard) return;

  const h = stack.getBoundingClientRect().height;
  barsCard.style.height = `${Math.max(260, Math.round(h))}px`;
  if (catBarsChart) catBarsChart.resize();
}

function buildDashCards(assos, statsMap) {
  // KPI
  $('#countTotal').text(assos.length);
  $('#countNoSite').text(assos.filter(a => !a.website).length);
  $('#countNoMail').text(assos.filter(a => !a.mail).length);

  // Données catégories → %
  const labels  = Object.keys(statsMap || {});
  const counts  = Object.values(statsMap || {}).map(v => Number(v) || 0);
  const total   = counts.reduce((a,b)=>a+b,0);
  const perc    = total>0 ? counts.map(v => +(v*100/total).toFixed(2)) : counts;

  // Palette Bootstrap
  const bsClasses = ['primary','success','warning','danger','info','secondary','dark'];
  const perClass  = labels.map((_,i)=> bsClasses[i % bsClasses.length]);
  const bgColors  = perClass.map(c => hexToRgba(bsColor(c), 0.85));
  const brColors  = perClass.map(c => bsColor(c));

  // Légende (badges) — une SEULE ligne, plein largeur, espacée
  const legend = document.getElementById('catLegend');
  if (legend) {
    // convertit le conteneur en flex ligne unique, pleine largeur
    legend.classList.remove('d-grid');
    legend.classList.add('d-flex','flex-nowrap','justify-content-between','align-items-center','gap-2','w-100');

    const esc = (s)=>String(s)
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'","&#039;");

    // chaque badge occupe une part égale de la largeur (flex-fill), en une seule ligne
    legend.innerHTML = labels.map((lab,i)=>
      `<span class="badge rounded-pill text-white bg-${perClass[i]} flex-fill text-center text-truncate" style="min-width:0;">${esc(lab)}</span>`
    ).join('');
  }

  // Chart
  const canvas = document.getElementById('catBars');
  if (!canvas) { setTimeout(equalizeBarsCardHeight, 0); return; }
  const ctx = canvas.getContext('2d');
  if (!ctx)  { setTimeout(equalizeBarsCardHeight, 0); return; }

  if (catBarsChart) { catBarsChart.destroy(); catBarsChart = null; }

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
        // espace réservé en bas pour UNE ligne de badges
        padding: { top: 4, right: 8, bottom: 42, left: 8 }
      },
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.parsed.y.toFixed(2)} %` }
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

  // Hauteur = pile de cartes de gauche
  setTimeout(equalizeBarsCardHeight, 0);
  window.addEventListener('resize', equalizeBarsCardHeight, { passive: true });

  // Si utilisée ailleurs
  setTimeout(window.adjustVisibleTables, 0);
}
