// static/js/init.js  (GLOBAL – pas de modules ici)

$(function(){
  // 1) Leaflet
  if ($('#niortMap').length) {
    initMap();
  }

  // 2) Associations + Stats
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

  // 3) RWD helper
  $('[data-toggle="tooltip"]').tooltip();
  function adjust(){
    $.fn.dataTable.tables({visible:true,api:true}).columns.adjust();
  }
  $(window).on('resize',   () => setTimeout(adjust,300));
  $('#sidebarToggle,#sidebarToggleTop').on('click', () => setTimeout(adjust,300));

  // 4) SSH forms
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
        const cls = resp.status === 'success' ? 'alert-success' : 'alert-danger';
        $status.html($('<div>').addClass(`alert ${cls}`).text(resp.message));
      })
      .fail(function(xhr) {
        const msg = xhr.responseJSON?.message || 'Erreur réseau ou serveur.';
        $status.html($('<div>').addClass('alert alert-danger').text(msg));
      })
      .always(function() {
        $btn.prop('disabled', false).text('Tester la connexion');
      });
    });
  }
});
