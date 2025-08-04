// static/js/datatable.js
import { formatBytesMBGB } from './utils.js';

const tNum = (x, d = 1) => x.toFixed(d) + ' %';

// stocke les raw rows groupées
let groupData = {};

// mémorise quels groupes sont ouverts
const expanded = new Set();

// extrait “bouchaud” de “wp_bouchaud”
function getGroup(name) {
  const parts = name.split('_');
  return parts.length > 1 ? parts.slice(1).join('_') : name;
}

// HTML du tableau enfant
function buildChildHtml(grp) {
  const list = groupData[grp] || [];
  return `<table class="table table-sm mb-0">
    <thead class="thead-light">
      <tr>
        <th>Service</th><th>CPU %</th><th>RAM %</th><th>RAM</th>
      </tr>
    </thead>
    <tbody>
      ${list.map(c => `
        <tr class="table-light">
          <td>${c.name}</td>
          <td>${tNum(c.cpu_pct)}</td>
          <td>${tNum(c.mem_pct)}</td>
          <td>${formatBytesMBGB(c.mem_used)} / ${formatBytesMBGB(c.mem_lim)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

export function createDashboardTable() {
  const dt = $('#contTable').DataTable({
    data: [],                      // on ajoutera les parents plus tard
    rowId: row => `parent_${row.name}`,
    columns: [
      {
        className: 'details-control',
        orderable: false,
        data: null,
        defaultContent: ''         // la cellule cliquable pour expand / collapse
      },
      { title: 'Nom',   data: 'name' },
      { title: 'CPU %', data: 'cpu'  },
      { title: 'RAM %', data: 'ramp' },
      { title: 'RAM',   data: 'ram'  }
    ],
    order: [[1, 'asc']],           // par défaut, tri alphabetique sur la colonne Nom
    language: {
      url: 'https://cdn.datatables.net/plug‑ins/1.13.8/i18n/fr‑FR.json'
    }
  });

  // click sur la chevron (colonne 0) d'un parent
  $('#contTable tbody').on('click', 'td.details-control', function() {
    const tr   = $(this).closest('tr');
    const row  = dt.row(tr);
    const data = row.data();
    const grp  = data.name;

    if (row.child.isShown()) {
      row.child.hide();
      tr.removeClass('shown');
      expanded.delete(grp);
    } else {
      row.child(buildChildHtml(grp)).show();
      tr.addClass('shown');
      expanded.add(grp);
    }
  });

  return dt;
}

export function updateDashboardTable(dt, raw) {
  // 1) regrouper raw par projet
  groupData = {};
  raw.forEach(r => {
    const grp = getGroup(r.name);
    (groupData[grp] = groupData[grp] || []).push(r);
  });

  // 2) ne garder que les parents pour le DataTable
  const parents = Object.entries(groupData).map(([grp, list]) => {
    const cpuSum = list.reduce((a,c) => a + c.cpu_pct, 0);
    const memSum = list.reduce((a,c) => a + c.mem_used, 0);
    const lim    = list[0].mem_lim || 1;
    return {
      name: grp,
      cpu:  tNum(cpuSum),
      ramp: tNum(memSum / lim * 100),
      ram:  `${formatBytesMBGB(memSum)} / ${formatBytesMBGB(lim)}`
    };
  });

  // 3) recharger le DataTable (parents uniquement), garder pagination/tri
  dt.clear().rows.add(parents).draw(false);

  // 4) ré-ouvrir les groupes qui l'étaient
  expanded.forEach(grp => {
    const row = dt.row(`#parent_${grp}`);
    if (row.node()) {
      row.child(buildChildHtml(grp)).show();
      $(row.node()).addClass('shown');
    }
  });
}
