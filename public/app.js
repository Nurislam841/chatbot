// Chart instances
let trendChartInstance = null;
let categoryChartInstance = null;
let branchChartInstance = null;

// Initial Load
document.addEventListener("DOMContentLoaded", () => {
    const DATE_EL = document.getElementById('currentDate');
    DATE_EL.innerText = new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Initial Fetch
    fetchStats();

    // Real-time Polling (Every 3 seconds)
    setInterval(fetchStats, 3000);
});

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        updateDashboard(data);
    } catch (e) {
        console.error("Failed to fetch stats", e);
    }
}

function updateDashboard(data) {
    // KPI Updates
    document.getElementById('totalReports').innerText = data.totals.reports;
    document.getElementById('totalCritical').innerText = data.totals.critical;
    document.getElementById('topTrain').innerText = `🚂 ${data.mostProblematicTrain.name} (${data.mostProblematicTrain.count})`;

    // Chart Updates
    updateTrendChart(data.dailyTrend);
    updateCategoryChart(data.categories);
    updateBranchChart(data.branches);
}

const COMMON_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 }, // Smooth update animation
    plugins: { legend: { labels: { color: '#94a3b8' } } },
    scales: {
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
    }
};

function updateTrendChart(trendData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const labels = trendData.map(d => d.date);
    const dataPoints = trendData.map(d => d.count);

    if (trendChartInstance) {
        trendChartInstance.data.labels = labels;
        trendChartInstance.data.datasets[0].data = dataPoints;
        trendChartInstance.update('none'); // Update without full redraw
    } else {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Обращения за 30 дней',
                    data: dataPoints,
                    borderColor: '#3b82f6',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: COMMON_OPTIONS
        });
    }
}

function updateCategoryChart(categories) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const labels = Object.keys(categories);
    const dataPoints = Object.values(categories);
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    if (categoryChartInstance) {
        categoryChartInstance.data.labels = labels;
        categoryChartInstance.data.datasets[0].data = dataPoints;
        categoryChartInstance.update();
    } else {
        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: dataPoints, backgroundColor: COLORS, borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
            }
        });
    }
}

function updateBranchChart(branches) {
    const ctx = document.getElementById('branchChart').getContext('2d');
    const labels = Object.keys(branches).map(b => b.replace('_', ' '));
    const dataPoints = Object.values(branches);

    if (branchChartInstance) {
        branchChartInstance.data.labels = labels;
        branchChartInstance.data.datasets[0].data = dataPoints;
        branchChartInstance.update();
    } else {
        branchChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Всего обращений',
                    data: dataPoints,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }]
            },
            options: { indexAxis: 'y', ...COMMON_OPTIONS }
        });
    }
}
