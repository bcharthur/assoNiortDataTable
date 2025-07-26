(function (global, $) {

  let dt   = null;   // instance DataTable
  let rows = [];     // données brutes

  /* valeurs uniques triées */
  const uniqSorted = arr =>
    [...new Set(arr)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));

  /* remplit <select> Catégorie & Sous‑catégorie */
  function populateSelects() {
    const $cat = $('#filterCat').empty().append('<option value="">Toutes</option>');
    const $sub = $('#filterSub').empty().append('<option value="">Toutes</option>');

    uniqSorted(rows.map(r => r.category)).forEach(v => $cat.append(`<option>${v}</option>`));
    uniqSorted(rows.map(r => r.sub_category)).forEach(v => $sub.append(`<option>${v}</option>`));
  }

  /* applique les filtres et redessine */
  function apply() {
    if (!dt) return;

    const regexEscape = $.fn.dataTable.util.escapeRegex;

    // Catégorie (col 1)
    const cat = $('#filterCat').val();
    dt.column(1).search(cat ? `^${regexEscape(cat)}$` : '', true, false);

    // Sous‑catégorie (col 2)
    const sub = $('#filterSub').val();
    dt.column(2).search(sub ? `^${regexEscape(sub)}$` : '', true, false);

    // Site internet (col 3)
    switch ($('input[name="siteRadio"]:checked').val()) {
      case 'with':    dt.column(3).search('.+', true, false);  break; // non vide
      case 'without': dt.column(3).search('^$', true, false);  break; // vide
      default:        dt.column(3).search('');
    }

    dt.draw(false);
  }

  /* public : branché depuis init.js */
  global.attachFilters = function (table, rawRows) {
    dt   = table;
    rows = rawRows;
    populateSelects();

    // listeners (namespace .flt)
    $('#filterCat, #filterSub').off('.flt').on('change.flt', apply);
    $('input[name="siteRadio"]').off('.flt').on('change.flt', apply);
    $('#resetFilters').off('.flt').on('click.flt', () => setTimeout(apply, 0));

    apply();   // premier rendu
  };

})(window, jQuery);
