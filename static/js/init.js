// static/js/init.js  (GLOBAL – pas de modules ici)

$(function () {
  // 1) Leaflet (uniquement si initMap est défini ET que l'élément est là)
  if (typeof window.initMap === 'function' && $('#niortMap').length) {
    try { window.initMap(); } catch (e) { console.error('initMap error:', e); }
  }

  // 2) Ancienne vue DataTable (ne rien faire si les fonctions n’existent pas)
  const hasLegacyTable = $('#assos-table').length > 0;
  const canBuildTable  = typeof window.buildAssosTable === 'function';
  if (hasLegacyTable && canBuildTable) {
    $.when(
      $.getJSON('/api/assos'),
      $.getJSON('/api/stats/category')
    )
      .done(function (assosResp, statsResp) {
        const assos = assosResp[0], stats = statsResp[0];

        // buildDashCards est optionnel (nouveau dashboard s’en charge déjà)
        if (typeof window.buildDashCards === 'function') {
          try { window.buildDashCards(assos, stats); } catch (e) { console.warn(e); }
        }

        const table = window.buildAssosTable(assos, function () {
          $('#loading').fadeOut(150, function () {
            $('#table-card').fadeIn(200);
          });
          if (typeof window.initAssos === 'function')   window.initAssos();
          if (typeof window.attachDetails === 'function') window.attachDetails(table);
          if (typeof window.attachMail === 'function')    window.attachMail(table);
        });
      })
      .fail(function () {
        $('#loading').html('<p class="text-danger">Erreur chargement.</p>');
      });
  }

  // 3) RWD helper (ajuste DataTables si présent)
  if ($.fn.dataTable) {
    function adjust() { $.fn.dataTable.tables({ visible: true, api: true }).columns.adjust(); }
    $(window).on('resize', () => setTimeout(adjust, 300));
    $('#sidebarToggle,#sidebarToggleTop').on('click', () => setTimeout(adjust, 300));
  }

  // 4) SSH forms
  if ($('.ssh-test-form').length) {
    $('.ssh-test-form').on('submit', function (e) {
      e.preventDefault();
      const $form = $(this);
      const $btn = $form.find('button');
      const $status = $form.siblings('.ssh-status');

      $status.empty();
      $btn.prop('disabled', true).text('Connexion…');

      $.ajax({
        url: $form.attr('action'),
        type: 'POST',
        dataType: 'json'
      })
        .done(function (resp) {
          const cls = resp.status === 'success' ? 'alert-success' : 'alert-danger';
          $status.html($('<div>').addClass(`alert ${cls}`).text(resp.message));
        })
        .fail(function (xhr) {
          const msg = xhr.responseJSON?.message || 'Erreur réseau ou serveur.';
          $status.html($('<div>').addClass('alert alert-danger').text(msg));
        })
        .always(function () {
          $btn.prop('disabled', false).text('Tester la connexion');
        });
    });
  }
});
