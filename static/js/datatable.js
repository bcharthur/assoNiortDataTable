(function (global, $) {

  /* -------- Colonnes avec classe 'text-truncate' -------- */
  const COLUMNS = [
    { data:'title',        title:'Titre',        className:'text-truncate' },
    { data:'category',     title:'Catégorie',    className:'text-truncate' },
    { data:'sub_category', title:'Sous‑Cat.',    className:'text-truncate' },
    {
      data:'website', title:'Site', className:'text-truncate',
      render:d=> d ? `<a href="${d}" target="_blank">lien</a>` : ''
    },
    { data:'manager',  title:'Responsable', className:'text-truncate' },
    { data:'contact',  title:'Contact',     className:'text-truncate' },
    { data:'phone',    title:'Tél.',        className:'text-truncate' },
    { data:'mobile',   title:'Portable',    className:'text-truncate' },
    { data:'mail',     title:'Mail',        className:'text-truncate' },
    { data:'address',  title:'Adresse',     className:'text-truncate' },
    { data:'description', title:'Description', className:'text-truncate' }
  ];

  const COL_WIDTHS = [ '220','120','160','130','160','140','110','110','180','250','400' ]
    .map((w,i)=>({width:`${w}px`,targets:i}));

  global.buildAssosTable = function (rows, onReady){

    const $tbl = $('#assos-table');

    if ($.fn.DataTable.isDataTable($tbl)){
      $tbl.DataTable().clear().rows.add(rows).draw(false);
      if(onReady)onReady(); return $tbl.DataTable();
    }

    const dt = $tbl.DataTable({
      data:rows, columns:COLUMNS, columnDefs:COL_WIDTHS,
      language:{url:'https://cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'},
      autoWidth:false, scrollX:true, scrollY:'60vh', scrollCollapse:true, responsive:false,
      colResize:{ realtime:true, handleWidth:8 },
      pageLength:25, processing:true, deferRender:true,

      initComplete:function(){
        const api=this.api();
        api.columns.adjust();
        if(onReady)onReady();
      }
    });

    /* ⇢ ajustement léger après chaque draw */
    dt.on('draw.dt', ()=> dt.columns.adjust());

    /* ⇢ ajustement EN FIN de drag ColResize (timeout 0 évite la récursion) */
    dt.on('column-sizing.dt', ()=> setTimeout(()=>dt.columns.adjust(),0));

    return dt;
  };

  global.adjustVisibleTables = ()=>
    $.fn.dataTable.tables({visible:true,api:true}).columns.adjust();

})(window,jQuery);
