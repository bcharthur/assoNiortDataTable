// static/js/assoNiort/init.js
$(function() {
  const $spinner   = $('#loading'),
        $tableCard = $('#table-card');

  // Affichage initial
  $spinner.show();
  $tableCard.hide();

  // 1) Initialise carte
  initMap();

  // 2) Charge assos + stats en parallèle
  $.when(
    $.getJSON('/api/assos'),
    $.getJSON('/api/stats/category')
  ).done((assosResp, statsResp) => {
    const assos = assosResp[0],
          stats = statsResp[0];

    // a) KPI + doughnut
    buildDashCards(assos, stats);

    // b) conserve pour export map
    localStorage.setItem('assosRaw', JSON.stringify(assos));

    // c) DataTable + filtres / détails / mail
    const table = buildAssosTable(assos, () => {
      $spinner.fadeOut(150, () => $tableCard.fadeIn(200));
      initAssos();                // filtres
      attachDetails(table);       // modal œil
      attachMail(table);          // modal mail
    });

    // d) Marqueurs sur la carte
    plotAssociations(assos);

  }).fail(() => {
    $spinner.html('<p class="text-danger">Erreur de chargement.</p>');
  });

  // 3) Ajustement responsive
  function adjust() {
    $.fn.dataTable.tables({ visible:true, api:true }).columns.adjust();
  }
  $(window).on('resize', () => setTimeout(adjust, 300));
  $('#sidebarToggle, #sidebarToggleTop')
    .on('click', () => setTimeout(adjust, 300));
});
