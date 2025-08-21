// static/js/docker/datatable.js
// Regroupe par application: parent = <appli>, enfants = wp_<appli>, db_<appli>
import { formatBytesBinary } from './utils.js';

function parseTypeAndSite(name) {
  const m = name.match(/^(wp|db)_(.+)$/i);
  if (m) return { type: m[1].toLowerCase(), site: m[2] };
  return { type: 'other', site: name };
}

function groupRowsByApp(rows) {
  const groups = new Map();

  for (const r of rows) {
    const { type, site } = parseTypeAndSite(r.name);
    if (!groups.has(site)) {
      groups.set(site, {
        site,
        children: [],
        cpu_sum: 0,
        mem_used_sum: 0,
        mem_lim_max: 0
      });
    }
    const g = groups.get(site);
    g.children.push({ ...r, _type: type, _site: site });
    g.cpu_sum += (r.cpu_pct || 0);
    g.mem_used_sum += (r.mem_used || 0);
    g.mem_lim_max = Math.max(g.mem_lim_max, r.mem_lim || 0);
  }

  const flat = [];
  for (const [, g] of groups) {
    const memPct = g.mem_lim_max > 0 ? (g.mem_used_sum / g.mem_lim_max * 100) : 0;

    // Parent (toujours avant ses enfants)
    flat.push({
      _isGroup: true,
      site: g.site,
      name: g.site,
      cpu_pct: +g.cpu_sum.toFixed(2),
      mem_pct: +memPct.toFixed(2),
      mem_used: g.mem_used_sum,
      mem_lim: g.mem_lim_max,
      // colonnes cachées pour le tri "fixe"
      _sort_site: g.site,
      _sort_kind: 0,         // 0 = parent, 1 = enfant
      _sort_type: -1,        // parent avant les types enfants
      _sort_name: g.site
    });

    // Enfants triés wp -> db -> other
    const typeOrder = { wp: 0, db: 1, other: 2 };
    const kids = [...g.children].sort((a, b) => {
      const ta = typeOrder[a._type] ?? 2;
      const tb = typeOrder[b._type] ?? 2;
      return ta - tb || a.name.localeCompare(b.name);
    });

    for (const c of kids) {
      flat.push({
        _isChild: true,
        _type: c._type,
        site: g.site,
        name: c.name,
        cpu_pct: c.cpu_pct,
        mem_pct: c.mem_pct,
        mem_used: c.mem_used,
        mem_lim: c.mem_lim,
        // tri "fixe"
        _sort_site: g.site,
        _sort_kind: 1,
        _sort_type: typeOrder[c._type] ?? 2,
        _sort_name: c.name
      });
    }
  }
  return flat;
}

function renderBadge(type) {
  if (type === 'wp') return '<span class="badge badge-primary">wp</span>';
  if (type === 'db') return '<span class="badge badge-secondary">db</span>';
  return '<span class="badge badge-light text-dark">other</span>';
}

export function buildDockerGroupedTable(initialRows) {
  const data = groupRowsByApp(initialRows);

  function renderChevron(_, __, row) {
    return row._isGroup ? '<span class="ast-chevron" style="cursor:pointer;">▸</span>' : '';
  }

  function renderName(data, type, row) {
    if (row._isGroup) return `<strong>${data}</strong>`;
    const short = (row._type === 'wp' || row._type === 'db')
      ? row.name.replace(/^(wp|db)_/i, '')
      : row.name;
    return `${renderBadge(row._type)} <span class="ml-1">${short}</span>`;
  }

  const table = $('#contTable').DataTable({
    data,
    // 👉 voir toutes les lignes par défaut
    paging: true,
    pageLength: -1,
    lengthMenu: [[-1, 10, 25, 50, 100], ['All', '10', '25', '50', '100']],
    searching: true,
    info: true,
    autoWidth: false,
    responsive: false,               // important: pas de flèche Responsive
    order: [],                       // pas d’ordre initial “visible”
    orderFixed: {                    // tri caché garantissant parent → enfants
      pre: [
        [5, 'asc'],  // _sort_site
        [6, 'asc'],  // _sort_kind (parent=0, enfant=1)
        [7, 'asc'],  // _sort_type (wp, db, other)
        [8, 'asc']   // _sort_name
      ]
    },
    columns: [
      { data: null, orderable: false, className: 'ast-toggle', width: '1%', render: renderChevron },
      { data: 'name', title: 'Nom', render: renderName, orderable: false },
      { data: 'cpu_pct', title: 'CPU %', render: d => Number(d||0).toFixed(2), orderable: false },
      { data: 'mem_pct', title: 'RAM %', render: d => Number(d||0).toFixed(2), orderable: false },
      { data: 'mem_used', title: 'RAM',   render: (_, __, row) => formatBytesBinary(row.mem_used), orderable: false },

      // colonnes cachées pour le tri fixe
      { data: '_sort_site', visible: false, searchable: false },
      { data: '_sort_kind', visible: false, searchable: false },
      { data: '_sort_type', visible: false, searchable: false },
      { data: '_sort_name', visible: false, searchable: false }
    ],
    rowCallback: function (row, rowData) {
      if (rowData._isChild) $(row).addClass('table-sm text-muted');
    },
    createdRow: function (row, rowData) {
      if (rowData._isChild) $(row).hide(); // plié par défaut
    }
  });

  // Toggle parent → affiche/masque uniquement SES enfants (contigus grâce à orderFixed)
  $('#contTable tbody').on('click', 'td.ast-toggle .ast-chevron', function () {
    const tr = $(this).closest('tr');
    const row = table.row(tr);
    const data = row.data();
    if (!data || !data._isGroup) return;

    const isOpen = tr.hasClass('shown');
    const idx = row.index();
    let i = idx + 1;
    while (i < table.rows().count()) {
      const next = table.row(i).data();
      if (!next || next._isGroup) break;
      const $tr = $(table.row(i).node());
      if (isOpen) $tr.hide(); else $tr.show();
      i++;
    }

    tr.toggleClass('shown');
    $(this).text(isOpen ? '▸' : '▾');
  });

  return table;
}

export function updateGroupedTable(table, newRows) {
  const data = groupRowsByApp(newRows);
  table.clear().rows.add(data).draw(false);
  // replier par défaut après MAJ (simple et sûr)
  table.rows().every(function () {
    const d = this.data();
    if (d && d._isChild) $(this.node()).hide();
  });
}
