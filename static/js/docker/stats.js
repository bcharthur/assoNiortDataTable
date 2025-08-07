// static/js/docker/stats.js
// <script type="module" src="/static/js/docker/stats.js"></script>

export function connectStats(table, onFirstStats) {
  if (typeof io !== 'function') {
    console.warn('socket.io non chargé : statistiques non disponibles');
    return;
  }
  const socket = io();
  let first = true;

  socket.on('stats', rows => {
    // updateDashboardTable doit être exporté de docker/datatable.js
    if (typeof updateDashboardTable === 'function') {
      updateDashboardTable(table, rows);
    }
    if (first && typeof onFirstStats === 'function') {
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

    // Mémoire
    $('#memVal').text(formatBytesMBGB(s.mem_used));
    $('#memMax').text(`/ ${formatBytesBinary(s.mem_total)}`);
    $('#memPct').text(((s.mem_used/s.mem_total)*100).toFixed(2) + ' %');
    p = s.mem_used/s.mem_total*100;
    memChart.data.datasets[0].data = [p, 100 - p];
    memChart.data.datasets[0].backgroundColor[0] = pctToColor(p);
    memChart.update();

    // Disque
    const free  = s.disk_free, total = s.disk_total;
    $('#diskVal').text(formatBytesMBGB(free) + ' free');
    $('#diskMax').text(`/ ${formatBytesMBGB(total)}`);
    const dp = (total-free)/total*100;
    $('#diskPct').text(dp.toFixed(2) + ' %');
    diskChart.data.datasets[0].data = [dp, 100 - dp];
    diskChart.data.datasets[0].backgroundColor[0] = pctToColor(dp);
    diskChart.update();
  });
}
