$(function () {
  const $spinner = $('#loading'),
        $table   = $('#table-card');

  /* chargement JSON parallèle */
  $.when(
    $.getJSON('/api/assos'),
    $.getJSON('/api/stats/category')
  ).done((assosResp, statsResp) => {

    const assos = assosResp[0];
    const stats = statsResp[0];

    /* cartes indicateurs */
    buildDashCards(assos, stats);

    /* DataTable : une seule création */
    const table = buildAssosTable(assos, () => {
      $spinner.fadeOut(150, () => $table.fadeIn(200));
      attachFilters(table, assos);         // ← brancher filtres ici
    });

    /* donut “catChart” */
    new Chart(document.getElementById('catChart'), {
      type: 'doughnut',
      data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats) }] },
      options: { plugins:{ legend:{ position:'right' } } }
    });

  }).fail(() => {
    $spinner.html('<p class="text-danger">Erreur de chargement.</p>');
  });

  /* ré‑ajuste si resize ou toggle sidebar */
  $(window).on('resize', adjustVisibleTables);
  $('#sidebarToggle, #sidebarToggleTop')
    .on('click', () => setTimeout(adjustVisibleTables, 300));
});
