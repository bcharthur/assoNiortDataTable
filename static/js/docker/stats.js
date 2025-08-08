// static/js/stats.js
import { cpuChart, memChart, diskChart, pctToColor } from './init.js';
import { updateDashboardTable } from './datatable.js';
import { formatBytesBinary, formatBytesMBGB } from './utils.js';

export function connectStats(table, onFirstStats) {
  const socket = io();
  let first = true;

  socket.on('stats', rows => {
    updateDashboardTable(table, rows);
    if (first && onFirstStats) {
      first = false;
      onFirstStats();
    }
  });

  socket.on('summary', s => {
    // CPU
    $('#cpuVal').text(s.cpu_pct_total.toFixed(2) + '%');
    $('#cpuMax').text(`/ ${s.cpu_pct_max}% (${s.cpus} CPUs)`);
    let p = s.cpu_pct_total;
    cpuChart.data.datasets[0].data = [p, 100 - p];
    cpuChart.data.datasets[0].backgroundColor[0] = pctToColor(p);
    cpuChart.update();

    // Memory
    $('#memVal').text(formatBytesMBGB(s.mem_used));
    $('#memMax').text(`/ ${formatBytesBinary(s.mem_total)}`);
    $('#memPct').text((s.mem_used / s.mem_total * 100).toFixed(2) + ' %');
    p = s.mem_used / s.mem_total * 100;
    memChart.data.datasets[0].data = [p, 100 - p];
    memChart.data.datasets[0].backgroundColor[0] = pctToColor(p);
    memChart.update();

    // Disk
    const free = s.disk_free;
    const total = s.disk_total;
    $('#diskVal').text(formatBytesMBGB(free) + ' free');
    $('#diskMax').text(`/ ${formatBytesMBGB(total)}`);
    let dp = (total - free) / total * 100;
    $('#diskPct').text(dp.toFixed(2) + ' %');
    diskChart.data.datasets[0].data = [dp, 100 - dp];
    diskChart.data.datasets[0].backgroundColor[0] = pctToColor(dp);
    diskChart.update();
  });
}
