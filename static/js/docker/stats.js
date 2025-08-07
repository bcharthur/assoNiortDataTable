// static/js/docker/stats.js
(function(window, $){
  function connectStats(table, onFirstStats, cpuChart, memChart, diskChart) {
    if (typeof io !== 'function') {
      console.warn('socket.io non chargé : statistiques désactivées');
      onFirstStats();
      return;
    }
    const socket = io(), first = { v: true };

    socket.on('stats', rows => {
      window.updateDashboardTable(table, rows);
      if (first.v) { first.v = false; onFirstStats(); }
    });
    socket.on('summary', s => {
      // CPU
      const pCpu = s.cpu_pct_total;
      cpuChart.data.datasets[0].data = [pCpu,100-pCpu];
      cpuChart.update();
      // MEM
      const pMem = (s.mem_used/s.mem_total)*100;
      memChart.data.datasets[0].data = [pMem,100-pMem];
      memChart.update();
      // DISK
      const pDisk = ((s.disk_total - s.disk_free)/s.disk_total)*100;
      diskChart.data.datasets[0].data = [pDisk,100-pDisk];
      diskChart.update();
    });
  }

  window.connectStats = connectStats;
})(window, jQuery);
