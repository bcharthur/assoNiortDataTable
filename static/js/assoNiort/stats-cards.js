function buildDashCards(assos, statsMap) {
  $('#countTotal').text(assos.length);
  $('#countNoSite').text(assos.filter(a => !a.website).length);
  $('#countNoMail').text(assos.filter(a => !a.mail).length);

  const canvas = document.getElementById('catDoughnut');
  if (!canvas) return;                              // sécurité

  const ctx = canvas.getContext('2d');
  if (!ctx) return;                                 // éviter “can’t acquire context”

  new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(statsMap),
            datasets: [{ data: Object.values(statsMap) }] },
    options: { plugins:{ legend:{ display:false } },
               cutout:'70%', animation:true }
  });

  /* déclenche un ajustement après le rendu visuel */
  setTimeout(window.adjustVisibleTables, 0);
}
