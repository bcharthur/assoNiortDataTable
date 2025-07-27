$(function () {

  const $spinner   = $('#loading'),
        $tableCard = $('#table-card');   // ← nom correct (au lieu de $table)

  /* chargement JSON parallèle */
  $.when(
    $.getJSON('/api/assos'),
    $.getJSON('/api/stats/category')
  ).done((assosResp, statsResp) => {

    const assos = assosResp[0];
    const stats = statsResp[0];

    /* cartes indicateurs (crée déjà le doughnut catDoughnut) */
    buildDashCards(assos, stats);

    /* DataTable : création unique */
    const table = buildAssosTable(assos, () => {
      $spinner.fadeOut(150, () => $tableCard.fadeIn(200));
      attachFilters(table, assos);   // filtres dynamiques
      attachDetails(table);          // bouton œil + modal détail
      localStorage.setItem('assosRaw', JSON.stringify(assos));
      plotAssociations(assos);   // place les marqueurs

    });

    /* plus besoin de créer un deuxième graphique sur #catChart
       — buildDashCards gère déjà le catDoughnut — */

  }).fail(() => {
    $spinner.html('<p class="text-danger">Erreur de chargement.</p>');
  });

  /* ré‑ajuste si resize ou toggle sidebar */
  $(window).on('resize', adjustVisibleTables);
  $('#sidebarToggle, #sidebarToggleTop')
    .on('click', () => setTimeout(adjustVisibleTables, 300));
});
