/* Filtres DataTables */
(function (global, $) {

  // stocke la référence DataTable (récupérée après build)
  let dt;

  global.attachFilters = function (dataTableInstance) {
    dt = dataTableInstance;
  };

  // === Catégorie ===
  $('#filterCat').on('change', function () {
    const val = $(this).val();
    dt.column(1).search(val ? '^' + val + '$' : '', true, false).draw();
  });

  // === Sous‑catégorie texte (contains) ===
  $('#filterSub').on('keyup change', function () {
    dt.column(2).search(this.value).draw();
  });

  // === Site web radio ===
  $('input[name="siteRadio"]').on('change', function () {
    const v = this.value;
    if (v === 'with')      dt.column(3).search('^((?!href).)*$', true, false); // lien present
    else if (v === 'without') dt.column(3).search('^$', true, false);         // champ vide
    else dt.column(3).search('');
    dt.draw();
  });

  // === Reset ===
  $('#resetFilters').on('click', function () {
    $('#filtersForm')[0].reset();
    $('#filterCat, #filterSub').trigger('change');
    $('input[name="siteRadio"][value=""]').prop('checked', true).trigger('change');
  });

})(window, jQuery);
