// static/js/docker/docker.js
function initDockerPage() {
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
      dataType: 'json',
    })
    .done(function(resp) {
      const cls = resp.status === 'success' ? 'alert-success' : 'alert-danger';
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
