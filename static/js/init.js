$(function () {
  const $spinner   = $('#loading'),
        $tableCard = $('#table-card'),
        $chartCard = $('#chart-card');

   $.when(
    $.getJSON('/api/assos'),
    $.getJSON('/api/stats/category')
  ).done((assosResp, statsResp) => {

    const assos = assosResp[0];
    const stats = statsResp[0];

    /* === cartes indicateurs === */
    buildDashCards(assos, stats);

    /* === DataTable === */
    buildAssosTable(assos, () => {
      $spinner.fadeOut(150, () => {
        $tableCard.fadeIn(200);
      });
    });

    const table = buildAssosTable(assos, () => {
  $spinner.fadeOut(150, () => $tableCard.fadeIn(200));
});
attachFilters(table);   // ← connecte les filtres à la DataTable

    /* donut */
    new Chart(document.getElementById('catChart'), {
      type: 'doughnut',
      data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats) }] },
      options: { plugins: { legend: { position: 'right' } } }
    });

  }).fail(() => {
    $spinner.html('<p class="text-danger">Erreur de chargement.</p>');
  });

  /* ---- réajuste au resize & au toggle sidebar ---- */
$(window).on('resize', adjustVisibleTables);
$('#sidebarToggle, #sidebarToggleTop').on('click', () => setTimeout(adjustVisibleTables, 300));

});
