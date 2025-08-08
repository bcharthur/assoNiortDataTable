// static/js/init.js

$(function(){
  // ─── 1) CARTE Leaflet ────────────────────────────────────────────────
  if ($('#niortMap').length) {
    initMap();  // défini dans js/assoNiort/map.js
  }

  // ─── 2) ASSOCIATIONS + RÉPARTITION ─────────────────────────────────
  $.when(
    $.getJSON('/api/assos'),
    $.getJSON('/api/stats/category')
  )
  .done(function(assosResp, statsResp){
    const assos = assosResp[0], stats = statsResp[0];

    buildDashCards(assos, stats);
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

  // ─── 3) TOOLTIP & RWD ───────────────────────────────────────────────
  $('#loadingModal').modal('show');
  $('[data-toggle="tooltip"]').tooltip();
  function adjust(){
    $.fn.dataTable.tables({visible:true,api:true}).columns.adjust();
  }
  $(window).on('resize',   () => setTimeout(adjust,300));
  $('#sidebarToggle,#sidebarToggleTop')
    .on('click', () => setTimeout(adjust,300));

  // ─── 4) SSH TEST FORMS ──────────────────────────────────────────────
  if ($('.ssh-test-form').length) {
    $('.ssh-test-form').on('submit', function(e) {
      e.preventDefault();
      const $form = $(this);
      const $btn  = $form.find('button');
      const $status = $form.siblings('.ssh-status');

      $status.empty();
      $btn.prop('disabled', true).text('Connexion…');

      $.ajax({
        url: $form.attr('action'),
        type: 'POST',
        dataType: 'json'
      })
      .done(function(resp) {
        const cls = resp.status === 'success'
          ? 'alert-success' : 'alert-danger';
        $status.html(
          $('<div>').addClass(`alert ${cls}`).text(resp.message)
        );
      })
      .fail(function(xhr) {
        const msg = xhr.responseJSON?.message || 'Erreur réseau ou serveur.';
        $status.html(
          $('<div>').addClass('alert alert-danger').text(msg)
        );
      })
      .always(function() {
        $btn.prop('disabled', false).text('Tester la connexion');
      });
    });
  }

  // ─── 5) DOCKER DASHBOARD ────────────────────────────────────────────
  if ($('#contTable').length) {
    /////////////////////////////////////////////////////////////////
    // Helpers
    function formatBytes(bytes, decimals = 1) {
      if (bytes === 0) return '0 B';
      const k = 1024,
            dm = decimals < 0 ? 0 : decimals,
            sizes = ['B','KB','MB','GB','TB','PB'],
            i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function createDonut(ctx, initialPct, color) {
      return new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [initialPct, 100 - initialPct],
            backgroundColor: [color, '#e9ecef'],
            borderWidth: 0
          }]
        },
        options: {
          cutout: '75%',
          plugins: { tooltip: { enabled: false } },
          hover: { mode: null },
          maintainAspectRatio: false
        }
      });
    }

    /////////////////////////////////////////////////////////////////
    // 5.1) Initialisation DataTable
    const contTable = $('#contTable').DataTable({
      data: [],
      columns: [
        { data: null, defaultContent: '', orderable: false, className: 'details-control' },
        { data: 'name',    title: 'Nom' },
        { data: 'cpu_pct', title: 'CPU %' },
        { data: 'mem_pct', title: 'RAM %' },
        { data: 'mem_used', title: 'RAM' }
      ],
      order: [[1, 'asc']],
      pageLength: 10,
      responsive: true,
      autoWidth: false
    });

    /////////////////////////////////////////////////////////////////
    // 5.2) Création des Charts
    const cpuCtx  = document.getElementById('cpuChart').getContext('2d');
    const memCtx  = document.getElementById('memChart').getContext('2d');
    const diskCtx = document.getElementById('diskChart').getContext('2d');

    const cpuChart  = createDonut(cpuCtx, 0,   '#4e73df');
    const memChart  = createDonut(memCtx, 0,   '#1cc88a');
    const diskChart = createDonut(diskCtx,0,   '#36b9cc');

    /////////////////////////////////////////////////////////////////
    // 5.3) Socket.IO – réception des données
    const socket = io();

    // Mises à jour de la table conteneurs
    socket.on('stats', function(rows) {
      const tableData = rows.map(r => ({
        name:    r.name,
        cpu_pct: r.cpu_pct,
        mem_pct: r.mem_pct,
        mem_used: formatBytes(r.mem_used)
      }));
      contTable.clear().rows.add(tableData).draw(false);
    });

    // Mises à jour des donuts + valeurs
    socket.on('summary', function(s) {
      // CPU
      cpuChart.data.datasets[0].data = [s.cpu_pct_total, 100-s.cpu_pct_total];
      cpuChart.update();
      $('#cpuVal').text(s.cpu_pct_total + ' %');
      $('#cpuMax').text('/ ' + s.cpus + ' CPUs');

      // RAM
      const usedMB  = +((s.mem_used / 1e6).toFixed(1));
      const totalMB = s.mem_total / 1e6;
      memChart.data.datasets[0].data = [
        usedMB/totalMB*100,
        100 - usedMB/totalMB*100
      ];
      memChart.update();
      $('#memVal').text(usedMB + ' MB');
      $('#memMax').text('/ ' + (totalMB/1024).toFixed(1) + ' GB');

      // Disque
      const usedDisk  = s.disk_total - s.disk_free;
      const usedGB    = +((usedDisk / 1e9).toFixed(1));
      const totalGB   = +(s.disk_total / 1e9).toFixed(1);
      diskChart.data.datasets[0].data = [
        usedGB/totalGB*100,
        100 - usedGB/totalGB*100
      ];
      diskChart.update();
      $('#diskVal').text(usedGB + ' GB');
      $('#diskMax').text('/ ' + totalGB + ' GB');
    });
  }

});
