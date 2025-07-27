(function (global, $) {

  global.attachDetails = function (dt) {

    $('#assos-table tbody').off('.detail')
      .on('click.detail', '.btn-detail', function () {

        const data = dt.row($(this).closest('tr')).data();
        if (!data) return;

        $('#assoTitle').text(data.title);

        /* corps en liste Bootstrap */
        $('#assoBody').html(`
          <ul class="list-group list-group-flush">
            <li class="list-group-item"><strong>Catégorie :</strong> ${data.category}</li>
            <li class="list-group-item"><strong>Sous‑catégorie :</strong> ${data.sub_category}</li>
            <li class="list-group-item"><strong>Responsable :</strong> ${data.manager}</li>
            <li class="list-group-item"><strong>Contact :</strong> ${data.contact}</li>
            <li class="list-group-item"><strong>Téléphone :</strong> ${data.phone || 'Pas de téléphone'}</li>
            <li class="list-group-item"><strong>Portable :</strong> ${data.mobile || 'Pas de mobile'}</li>
            <li class="list-group-item"><strong>Mail :</strong> ${data.mail || 'Pas de mail'}</li>
            <li class="list-group-item"><strong>Adresse :</strong> ${data.address}</li>
            <li class="list-group-item"><strong>Description :</strong><br>${data.description}</li>
            <li class="list-group-item"><strong>Site :</strong> ${
              data.website ? `<a href="${data.website}" target="_blank">${data.website}</a>` : 'Pas de site internet'
            }</li>
          </ul>
        `);
        $('#assoModal').modal('show');
      });
  };

})(window, jQuery);
