// static/js/docker/stats.js
import { cpuChart, memChart, diskChart, pctToColor } from './init.js';
import { buildDockerGroupedTable, updateGroupedTable } from './datatable.js';
import { formatBytesBinary, formatBytesMBGB } from './utils.js';

let groupedTable = null;

export function connectStats() {
  const socket = io();

  socket.on('stats', rows => {
    if (!groupedTable) {
      groupedTable = buildDockerGroupedTable(rows);
    } else {
      updateGroupedTable(groupedTable, rows);
    }
  });

  socket.on('summary', s => {
    // --- CPU (hôte) ---
    const hostPct = Math.max(0, Math.min(100, Number(s.cpu_pct_total || 0)));
    $('#cpuVal').text(hostPct.toFixed(2) + '%');
    $('#cpuMax').text(`/ ${s.cpus || 0} CPUs`);

    // Afficher aussi la somme brute des conteneurs et son approx. hôte
    if (typeof s.cpu_containers_sum === 'number' && s.cpus > 0) {
      const contSum = s.cpu_containers_sum;
      const approxHost = contSum / s.cpus;
      // Ajoute (ou met à jour) une petite note à côté
      const note = `somme conteneurs: ${contSum.toFixed(2)}% ≈ ${approxHost.toFixed(2)}% hôte`;
      if ($('#cpuNote').length) {
        $('#cpuNote').text(note);
      } else {
        $('#cpuMax').after(` <small id="cpuNote" class="text-muted">(${note})</small>`);
      }
    }

    if (cpuChart) {
      cpuChart.data.datasets[0].data = [hostPct, 100 - hostPct];
      cpuChart.data.datasets[0].backgroundColor[0] = pctToColor(hostPct);
      cpuChart.update();
    }

    // --- RAM (hôte) ---
    const memUsed = Number(s.mem_used || 0);
    const memTot  = Number(s.mem_total || 0);
    $('#memVal').text(formatBytesMBGB(memUsed));
    $('#memMax').text(`/ ${formatBytesBinary(memTot)}`);
    const memPct = memTot > 0 ? (memUsed / memTot * 100) : 0;
    $('#memPct').text(memPct.toFixed(2) + ' %');

    if (memChart) {
      const p = Math.max(0, Math.min(100, memPct));
      memChart.data.datasets[0].data = [p, 100 - p];
      memChart.data.datasets[0].backgroundColor[0] = pctToColor(p);
      memChart.update();
    }

    // --- Disque (hôte) ---
    const total = Number(s.disk_total || 0);
    const free  = Number(s.disk_free  || 0);
    const usedB = Math.max(0, total - free);
    $('#diskVal').text(formatBytesMBGB(free) + ' free');
    $('#diskMax').text(`/ ${formatBytesMBGB(total)}`);
    const diskPct = total > 0 ? (usedB / total * 100) : 0;
    $('#diskPct').text(diskPct.toFixed(2) + ' %');

    if (diskChart) {
      const p = Math.max(0, Math.min(100, diskPct));
      diskChart.data.datasets[0].data = [p, 100 - p];
      diskChart.data.datasets[0].backgroundColor[0] = pctToColor(p);
      diskChart.update();
    }
  });
}
