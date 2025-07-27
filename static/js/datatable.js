(function (global, $) {

  const COLUMNS = [
    { data:null, title:'', orderable:false, searchable:false,
      width:'40px', className:'text-center',
      render: () => '<button class="btn btn-sm btn-primary btn-detail"><i class="fas fa-eye"></i></button>'
    },
    { data:'title',        title:'Titre',         className:'text-truncate' },
    { data:'category',     title:'Catégorie',     className:'text-truncate' },
    { data:'sub_category', title:'Sous‑Cat.',     className:'text-truncate' },
    { data:'website',      title:'Site',          className:'text-truncate',
      render:d => d ? `<a href="${d}" target="_blank">lien</a>` : '' },
    { data:'manager',      title:'Responsable',   className:'text-truncate' },
    { data:'contact',      title:'Contact',       className:'text-truncate' },
    /* — nouvelle colonne téléphones — */
    { data:null, title:'Téléphones', className:'text-truncate',
      render:d => {
        const parts = [];
        if (d.phone)   parts.push(d.phone);
        if (d.mobile)  parts.push(d.mobile);
        return parts.join(' / ');
      }
    },
     /* Mail sans “mailto:” */
    { data:'mail', title:'Mail', className:'text-truncate',
      render:d => {
        if (!d) return '';
        const m = d.replace(/^mailto:/i, '');
        return `<a href="mailto:${m}">${m}</a>`;
      }
    },
    { data:'address',      title:'Adresse',       className:'text-truncate' },
    { data:'description',  title:'Description',  className:'text-truncate' },

  ];

  const COL_WIDTHS = [
    '40','220','120','160','40','160','140','110','180','250','400'
  ].map((w,i)=>({width:`${w}px`,targets:i}));

  global.buildAssosTable = function (rows, onReady) {

    const $tbl = $('#assos-table');

    if ($.fn.DataTable.isDataTable($tbl)) {
      const api = $tbl.DataTable();
      api.clear().rows.add(rows).draw(false);
      if (onReady) onReady();
      return api;
    }

    const dt = $tbl.DataTable({
      data: rows,
      columns: COLUMNS,
      columnDefs: COL_WIDTHS,
      language:{url:'https://cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json'},
      autoWidth:false, scrollX:true, scrollY:'60vh', scrollCollapse:true, responsive:false,
      colResize:{ realtime:true, handleWidth:8 },
      pageLength:25, processing:true, deferRender:true,

      initComplete:function () {
        this.api().columns.adjust();
        if (onReady) onReady();
      }
    });

    dt.on('draw.dt', () => dt.columns.adjust());
    dt.on('column-sizing.dt', () => setTimeout(()=>dt.columns.adjust(), 0));

    return dt;
  };

  global.adjustVisibleTables = () =>
    $.fn.dataTable.tables({ visible:true, api:true }).columns.adjust();

})(window, jQuery);
