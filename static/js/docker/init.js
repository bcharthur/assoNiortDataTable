// static/js/docker/init.js
import { connectStats } from './stats.js';

// Helpers couleurs
export function pctToColor(p) {
  if (p < 50) return '#1cc88a';
  if (p < 80) return '#f6c23e';
  return '#e74a3b';
}

// Crée un donut Chart.js et le retourne
function createDonut(ctx, initialPct) {
  return new Chart(ctx, {
    type: 'doughnut',
    data: { datasets: [{ data: [initialPct, 100 - initialPct], backgroundColor: ['#e9ecef', '#e9ecef'], borderWidth: 0 }] },
    options: { cutout: '75%', plugins: { tooltip: { enabled: false } }, hover: { mode: null }, maintainAspectRatio: false }
  });
}

// Crée les 3 charts et les exporte
const cpuCtx  = document.getElementById('cpuChart')?.getContext('2d');
const memCtx  = document.getElementById('memChart')?.getContext('2d');
const diskCtx = document.getElementById('diskChart')?.getContext('2d');

export const cpuChart  = cpuCtx  ? createDonut(cpuCtx, 0)  : null;
export const memChart  = memCtx  ? createDonut(memCtx, 0)  : null;
export const diskChart = diskCtx ? createDonut(diskCtx, 0) : null;

// Démarre le flux Socket.IO si on est sur la page Docker
if (document.getElementById('contTable')) {
  connectStats();
}
