import { createDashboardTable } from './datatable.js';
import { connectStats }        from './stats.js';

let cpuChart, memChart, diskChart;

function createDonutChart(ctx, initialPct, color) {
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [initialPct, 100 - initialPct],
        backgroundColor: [color, '#eee'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '75%',
      tooltips: { enabled: false },
      hover:    { mode: null },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Calcule la couleur du pourcentage 0→green, 100→red
function pctToColor(pct) {
  const hue = ((1 - pct/100) * 120).toFixed(0); // 120° vert → 0° rouge
  return `hsl(${hue}, 100%, 50%)`;
}

document.addEventListener('DOMContentLoaded', () => {
  // Ouvre la modal au démarrage
  $('#loadingModal').modal('show');

  $('[data-toggle="tooltip"]').tooltip();
  const table = createDashboardTable();

  // Crée les charts à 0%
  cpuChart  = createDonutChart(document.getElementById('cpuChart').getContext('2d'), 0, pctToColor(0));
  memChart  = createDonutChart(document.getElementById('memChart').getContext('2d'), 0, pctToColor(0));
  diskChart = createDonutChart(document.getElementById('diskChart').getContext('2d'), 0, pctToColor(0));

  connectStats(table, () => {
    $('#loadingModal').modal('hide');
  });
});

// Expose pour stats.js
export { cpuChart, memChart, diskChart, pctToColor };
