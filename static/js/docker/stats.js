// static/js/docker/stats.js
import { cpuChart, memChart, diskChart, pctToColor } from './init.js';
import { buildDockerGroupedTable, updateGroupedTable } from './datatable.js';
import { formatBytesBinary, formatBytesMBGB } from './utils.js';

let groupedTable = null;

// On garde en mémoire le nb de vCPU de l'hôte et la dernière liste brute
let HOST_CPUS = 1;
let lastRowsRaw = [];

function applyRowsToTable() {
  if (!lastRowsRaw || !Array.isArray(lastRowsRaw)) return;

  // Normalisation CPU conteneur -> % hôte
  // - docker: cpu_pct = % d’un cœur
  // - affichage souhaité: % hôte = cpu_pct / HOST_CPUS
  const rows = lastRowsRaw.map(r => {
    const raw = Number(r.cpu_pct || 0);
    const norm = HOST_CPUS > 0 ? (raw / HOST_CPUS) : raw;
    return {
      ...r,
      cpu_pct_docker: raw,           // on garde l’original si besoin en tooltip
      cpu_pct: Number(norm.toFixed(2))
    };
  });

  if (!groupedTable) {
    groupedTable = buildDockerGroupedTable(rows);
  } else {
    updateGroupedTable(groupedTable, rows);
  }
}

export function connectStats() {
  const socket = io();

  // 1) Lignes de conteneurs (brutes, en % docker)
  socket.on('stats', rows => {
    lastRowsRaw = rows || [];
    applyRowsToTable(); // affichera avec la dernière valeur connue de HOST_CPUS
  });

  // 2) Résumé hôte (CPU, RAM, disque) — vient du VPS
  socket.on('summary', s => {
    // --- CPU (hôte) ---
    const hostPct = Math.max(0, Math.min(100, Number(s.cpu_pct_total || 0)));
    HOST_CPUS = Number(s.cpus || HOST_CPUS || 1); // MAJ nb vCPU
    $('#cpuVal').text(hostPct.toFixed(2) + '%');
    $('#cpuMax').text(`/ ${HOST_CPUS} CPUs`);

    if (cpuChart) {
      cpuChart.data.datasets[0].data = [hostPct, 100 - hostPct];
      cpuChart.data.datasets[0].backgroundColor[0] = pctToColor(hostPct);
      cpuChart.update();
    }

    // Affine le tableau si on vient d’apprendre le vrai nombre de vCPU
    applyRowsToTable();

    // --- RAM (hôte) ---
    // Affiche la même unité pour used/total (GB décimal), comme le VPS.
    const memUsed = Number(s.mem_used || 0);
    const memTot  = Number(s.mem_total || 0);
    $('#memVal').text(formatBytesMBGB(memUsed));
    $('#memMax').text(`/ ${formatBytesMBGB(memTot)}`);
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
