/* global buildAssosTable, adjustVisibleTables */
(function (global, $) {
  let dt         = null;    // instance DataTable
  let rows       = [];      // lignes courantes (après filtre)
  let masterRows = [];      // toutes les lignes (chargement initial)

  /* ──────────────────────────────────────────────────────────── */
  function fetchRows(params = {}, cb) {
    $.getJSON("/api/assos", params, data => {
      rows = data;

      if (dt) {
        dt.clear().rows.add(rows).draw(false);
      } else {
        dt = buildAssosTable(rows, adjustVisibleTables);
      }

      if ($.isEmptyObject(params) && masterRows.length === 0) {
        // premier load sans filtre → on garde la référence complète
        masterRows = rows.slice();
      }
      if (cb) cb();
    });
  }

  /* ─────────────────── listes déroulantes ───────────────────── */
  function populateSelects() {
    const uniq = arr =>
      [...new Set(arr)]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "fr"));

    // on conserve la sélection courante
    const curCat = $("#filterCat").val() || "";
    const curSub = $("#filterSub").val() || "";

    const $cat = $("#filterCat").empty().append('<option value="">Toutes</option>');
    const $sub = $("#filterSub").empty().append('<option value="">Toutes</option>');

    uniq(masterRows.map(r => r.category)).forEach(v => $cat.append(`<option>${v}</option>`));
    uniq(masterRows.map(r => r.sub_category)).forEach(v => $sub.append(`<option>${v}</option>`));

    // on ré‑applique la valeur si elle existe toujours
    $cat.val(curCat);
    $sub.val(curSub);
  }

  /* ─────────────────── application des filtres ───────────────── */
  function applyFilters() {
    const params = {};
    const cat  = $("#filterCat").val();
    const sub  = $("#filterSub").val();
    const site = $("input[name='siteRadio']:checked").val();

    if (cat)  params.cat  = cat;
    if (sub)  params.sub  = sub;
    if (site) params.site = site;

    fetchRows(params);          // pas besoin de repopuler les selects ici
  }

  /* ────────────────────── Export global ─────────────────────── */
  global.initAssos = function () {
    // premier chargement (sans filtre)
    fetchRows({}, () => {
      populateSelects();

      // écouteurs UI
      $("#filterCat,#filterSub").on("change.flt", applyFilters);
      $("input[name='siteRadio']").on("change.flt", applyFilters);

      $("#resetFilters").on("click.flt", () => {
        $("#filterCat,#filterSub").val("");
        $("#siteAll").prop("checked", true);
        applyFilters();
      });
    });
  };
})(window, jQuery);
