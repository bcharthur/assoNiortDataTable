(function (global, $) {

  let dt   = null;   // instance DataTable
  let data = [];     // dataset brut

  /* valeurs uniques triées */
  const uniqSorted = list =>
    [...new Set(list)].filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr'));

  /* construit la liste Sous‑catégories */
  function fillSubOptions() {
    const $sel = $('#filterSub');
    $sel.empty().append('<option value="">Toutes</option>');
    uniqSorted(data.map(r => r.sub_category))
      .forEach(v => $sel.append(`<option>${v}</option>`));
  }

  /* applique les filtres et redessine */
  function apply() {
    if (!dt) return;

    // Catégorie (col 1)
    const cat = $('#filterCat').val();
    dt.column(1).search(cat ? `^${cat}$` : '', true, false);

    // Sous‑catégorie (col 2)
    const sub = $('#filterSub').val();
    dt.column(2).search(sub ? `^${sub}$` : '', true, false);

    // Site internet (col 3)
    switch ($('input[name="siteRadio"]:checked').val()) {
      case 'with':    dt.column(3).search('.+', true, false);  break; // non vide
      case 'without': dt.column(3).search('^$', true, false);  break; // vide
      default:        dt.column(3).search('');
    }

    dt.draw(false);
  }

  /* public : appelé depuis init.js */
  global.attachFilters = function (table, rawRows) {
    dt   = table;
    data = rawRows;
    fillSubOptions();

    // listeners (namespace .flt pour éviter doublons)
    $('#filterCat, #filterSub').off('.flt').on('change.flt', apply);
    $('input[name="siteRadio"]').off('.flt').on('change.flt', apply);
    $('#resetFilters').off('.flt').on('click.flt', () => setTimeout(apply, 0));

    apply();               // première application
  };

})(window, jQuery);
