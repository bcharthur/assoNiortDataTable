// static/js/init.js
$(function(){
  // ─── 1) CARTE ───────────────────────────
  // $('#mapLoader').show();
  initMap();  // défini par assoNiort/map.js

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

    // c) Marqueurs
    plotAssociations(assos);
  })
  .fail(function(){
    $('#loading').html('<p class="text-danger">Erreur chargement.</p>');
  });

  // ─── 3) STATS CONTENEURS ─────────────────
  $('#loadingModal').modal('show');
  $('[data-toggle="tooltip"]').tooltip();

  // a) tableau
  const contTable = window.createDashboardTable();

  // b) trois doughnuts vides
  function makeDonut(id){
    const ctx = document.getElementById(id).getContext('2d');
    return new Chart(ctx, {
      type:'doughnut',
      data:{ datasets:[{ data:[0,100], backgroundColor:['#eee','#eee'], borderWidth:0 }] },
      options:{ cutout:'75%', plugins:{ legend:{display:false} }, tooltips:{enabled:false}, hover:{mode:null} }
    });
  }
  const cpuChart  = makeDonut('cpuChart');
  const memChart  = makeDonut('memChart');
  const diskChart = makeDonut('diskChart');

  // c) socket → connectStats(table, cb, cpuChart, memChart, diskChart)
  window.connectStats(contTable, function(){
    $('#loadingModal').modal('hide');
  }, cpuChart, memChart, diskChart);

  // ─── 4) RWD ──────────────────────────────
  function adjust(){
    $.fn.dataTable.tables({visible:true,api:true}).columns.adjust();
  }
  $(window).on('resize',   () => setTimeout(adjust,300));
  $('#sidebarToggle,#sidebarToggleTop')
    .on('click',      () => setTimeout(adjust,300));
});
