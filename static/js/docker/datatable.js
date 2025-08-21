// static/js/docker/datatable.js
// DataTable = lignes "appli" uniquement ; les conteneurs (wp_/db_) sont
// affichés dans un panneau détaillé (child row) au clic.
import { formatBytesBinary } from './utils.js';

// ────────────────────────────────────────────────────────────────────────────────
// Helpers de parsing & regroupement
// ────────────────────────────────────────────────────────────────────────────────
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
        cpu_sum: 0,
        mem_used_sum: 0,
        mem_lim_max: 0,
        children: []
      });
    }
    const g = groups.get(site);
    g.children.push({ ...r, _type: type, _site: site });
    g.cpu_sum      += (r.cpu_pct  || 0);
    g.mem_used_sum += (r.mem_used || 0);
    g.mem_lim_max   = Math.max(g.mem_lim_max, r.mem_lim || 0);
  }

  // Transforme en liste de groupes (lignes du tableau)
  const list = [];
  for (const [, g] of groups) {
    const memPct = g.mem_lim_max > 0 ? (g.mem_used_sum / g.mem_lim_max * 100) : 0;
    list.push({
      site: g.site,
      name: g.site,
      cpu_pct: +g.cpu_sum.toFixed(2),
      mem_pct: +memPct.toFixed(2),
      mem_used: g.mem_used_sum,
      mem_lim: g.mem_lim_max,
      // on garde les enfants triés wp -> db -> other puis nom
      children: [...g.children].sort((a, b) => {
        const order = { wp: 0, db: 1, other: 2 };
        const da = order[a._type] ?? 2;
        const dbb = order[b._type] ?? 2;
        return da - dbb || a.name.localeCompare(b.name);
      })
    });
  }

  return list;
}

function badge(type) {
  if (type === 'wp') return '<span class="badge badge-primary">wp</span>';
  if (type === 'db') return '<span class="badge badge-secondary">db</span>';
  return '<span class="badge badge-light text-dark">other</span>';
}

// Génére le contenu HTML du panneau détaillé (child row)
function renderChildTable(children) {
  const rows = children.map(c => {
    const short = (c._type === 'wp' || c._type === 'db')
      ? c.name.replace(/^(wp|db)_/i, '')
      : c.name;
    const cpu = Number(c.cpu_pct || 0).toFixed(2);
    const mem = Number(c.mem_pct || 0).toFixed(2);
    const ram = formatBytesBinary(c.mem_used || 0);

    return `
      <tr>
        <td class="align-middle" style="width:1%">${badge(c._type)}</td>
        <td class="align-middle">${short}</td>
        <td class="align-middle text-right">${cpu}</td>
        <td class="align-middle text-right">${mem}</td>
        <td class="align-middle text-right">${ram}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="p-2">
      <table class="table table-sm table-borderless mb-0">
        <thead class="text-muted">
          <tr>
            <th style="width:1%"></th>
            <th>Conteneur</th>
            <th class="text-right">CPU %</th>
            <th class="text-right">RAM %</th>
            <th class="text-right">RAM</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" class="text-muted">Aucun conteneur.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────────────────────────
// DataTable
// ────────────────────────────────────────────────────────────────────────────────
export function buildDockerGroupedTable(initialRows) {
  const groups = groupRowsByApp(initialRows);

  // Mémorise quels groupes sont ouverts (par site)
  const openGroups = new Set();

  function renderChevron() {
    return '<span class="ast-chevron" style="cursor:pointer;">▸</span>';
  }
  function renderName(data/* , type, row */) {
    return `<strong>${data}</strong>`;
  }

  const table = $('#contTable').DataTable({
    data: groups,
    rowId: (row) => `app-${row.site}`,   // id stable pour retrouver la ligne
    paging: true,
    pageLength: -1,
    lengthMenu: [[-1, 10, 25, 50, 100], ['All', '10', '25', '50', '100']],
    searching: true,
    info: true,
    autoWidth: false,
    responsive: false,
    deferRender: true,

    // ordre par défaut : nom
    order: [[1, 'asc']],

    columns: [
      { data: null, className: 'ast-toggle', orderable: false, width: '1%', render: renderChevron },
      { data: 'name', title: 'Nom', orderable: true, render: renderName },
      { data: 'cpu_pct', title: 'CPU %', orderable: true, className: 'text-right',
        render: (d) => Number(d||0).toFixed(2) },
      { data: 'mem_pct', title: 'RAM %', orderable: true, className: 'text-right',
        render: (d) => Number(d||0).toFixed(2) },
      { data: 'mem_used', title: 'RAM', orderable: true, className: 'text-right',
        render: (_, __, row) => formatBytesBinary(row.mem_used || 0) }
    ]
  });

  // Ouvre/ferme un groupe (ligne parent) avec child row
  function toggleRow(tr) {
    const row = table.row(tr);
    const data = row.data();
    if (!data) return;

    const site = data.site;
    const isOpen = row.child.isShown();

    if (isOpen) {
      row.child.hide();
      $(tr).removeClass('shown').find('.ast-chevron').text('▸');
      openGroups.delete(site);
    } else {
      row.child(renderChildTable(data.children)).show();
      $(tr).addClass('shown').find('.ast-chevron').text('▾');
      openGroups.add(site);
    }
  }

  // Restaure l’état d’ouverture après tri / recherche / pagination
  function restoreOpenState() {
    table.rows({ page: 'current' }).every(function () {
      const tr = $(this.node());
      const d  = this.data();
      if (!d) return;
      if (openGroups.has(d.site)) {
        if (!this.child.isShown()) {
          this.child(renderChildTable(d.children)).show();
          tr.addClass('shown').find('.ast-chevron').text('▾');
        } else {
          // si déjà ouvert, on regénère le contenu (données fraîches)
          this.child(renderChildTable(d.children));
          tr.find('.ast-chevron').text('▾');
        }
      } else {
        if (this.child && this.child.isShown()) this.child.hide();
        tr.removeClass('shown').find('.ast-chevron').text('▸');
      }
    });
  }

  // Click sur chevron
  $('#contTable tbody').on('click', 'td.ast-toggle .ast-chevron', function () {
    toggleRow($(this).closest('tr'));
  });

  // À chaque redraw (tri/recherche/length/page), réapplique l’état des groupes
  table.on('draw.dt order.dt search.dt page.dt length.dt', restoreOpenState);

  // 1er passage
  restoreOpenState();

  // stocke pour update()
  table._openGroups = openGroups;
  table._restore = restoreOpenState;
  return table;
}

export function updateGroupedTable(table, newRows) {
  const openGroups = table._openGroups || new Set();
  const restore    = table._restore || function(){};

  const groups = groupRowsByApp(newRows);

  // réinjecte les nouvelles données
  table.clear().rows.add(groups).draw(false);

  // rétablir l’état d’ouverture + régénérer les panels ouverts
  restore();
}
