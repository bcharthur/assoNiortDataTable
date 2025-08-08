// static/js/init.js
$(function(){
  // ─── 1) CARTE ───────────────────────────
  // $('#mapLoader').show();
  if ( $('#niortMap').length ) {
    initMap();  // n’est appelé que si #niortMap existe
  }

  // ─── 2) ASSOCIATIONS + RÉPARTITION ──────
  $.when(
    $.getJSON('/api/assos'),
    $.getJSON('/api/stats/category')
  )
  .done(function(assosResp, statsResp){
    const assos = assosResp[0], stats = statsResp[0];

    // a) Doughnut “répartition”
    buildDashCards(assos, stats);

    // b) DataTable + filtres / détails / mail
    const table = buildAssosTable(assos, function(){
      $('#loading').fadeOut(150, function(){
        $('#table-card').fadeIn(200);
      });
      initAssos();
      attachDetails(table);
      attachMail(table);
    });
  })
  .fail(function(){
    $('#loading').html('<p class="text-danger">Erreur chargement.</p>');
  });

  // ─── 3) STATS CONTENEURS ─────────────────
  $('#loadingModal').modal('show');
  $('[data-toggle="tooltip"]').tooltip();

  // ─── 4) RWD ──────────────────────────────
  function adjust(){
    $.fn.dataTable.tables({visible:true,api:true}).columns.adjust();
  }
  $(window).on('resize',   () => setTimeout(adjust,300));
  $('#sidebarToggle,#sidebarToggleTop')
    .on('click',      () => setTimeout(adjust,300));

   // 5) Docker SSH page ?
  if ( $('.ssh-test-form').length && typeof initDockerPage === 'function' ) {
    initDockerPage();
  }
});
