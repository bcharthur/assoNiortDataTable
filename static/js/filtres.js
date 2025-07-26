(function (global, $) {

  let dt = null;
  let rows = [];

  const uniqSorted = arr =>
    [...new Set(arr)].filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr'));

  function populateSelects() {
    const $cat = $('#filterCat').empty().append('<option value="">Toutes</option>');
    const $sub = $('#filterSub').empty().append('<option value="">Toutes</option>');
    uniqSorted(rows.map(r => r.category)).forEach(v => $cat.append(`<option>${v}</option>`));
    uniqSorted(rows.map(r => r.sub_category)).forEach(v => $sub.append(`<option>${v}</option>`));
  }

  function apply() {
    if (!dt) return;
    const esc = $.fn.dataTable.util.escapeRegex;

    // indexes après la colonne "œil"
    const COL_CAT  = 2;
    const COL_SUB  = 3;
    const COL_SITE = 4;

    const cat = $('#filterCat').val();
    dt.column(COL_CAT).search(cat ? `^${esc(cat)}$` : '', true, false);

    const sub = $('#filterSub').val();
    dt.column(COL_SUB).search(sub ? `^${esc(sub)}$` : '', true, false);

    switch ($('input[name="siteRadio"]:checked').val()) {
      case 'with':    dt.column(COL_SITE).search('.+', true, false);  break;  // non vide
      case 'without': dt.column(COL_SITE).search('^$', true, false);  break;  // vide
      default:        dt.column(COL_SITE).search('');
    }
    dt.draw(false);
  }

  global.attachFilters = function (table, rawRows) {
    dt   = table;
    rows = rawRows;
    populateSelects();

    $('#filterCat, #filterSub').off('.flt').on('change.flt', apply);
    $('input[name="siteRadio"]').off('.flt').on('change.flt', apply);
    $('#resetFilters').off('.flt').on('click.flt', () => setTimeout(apply,0));

    apply();
  };

})(window, jQuery);
