const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { REPORTS_DIR, BRANCHES_DIR } = require('./excel');
const logger = require('./logger');

const app = express();
// Default to 3030 as requested by user ("another port")
const PORT = process.env.DASHBOARD_PORT || 3030;

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// API Endpoint: Get Aggregated Stats
// This reads files effectively in real-time (on every request)
app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            totals: {
                gmv: 0, 
                reports: 0,
                critical: 0,
                solved: 0 
            },
            categories: {},
            branches: {},
            dailyTrend: Array(30).fill(0).map((_, i) => {
                 const d = new Date(); 
                 d.setDate(d.getDate() - (29 - i));
                 return { date: d.toISOString().split('T')[0], count: 0 };
            }),
            mostProblematicTrain: { name: 'N/A', count: 0 },
            lastUpdated: new Date().toISOString()
        };

        const trainCounts = {};

        if (fs.existsSync(BRANCHES_DIR)) {
            const files = fs.readdirSync(BRANCHES_DIR).filter(f => f.endsWith('.xlsx'));
            
            for (const file of files) {
                const branchName = file.replace('.xlsx', '');
                
                // Read file
                const workbook = xlsx.readFile(path.join(BRANCHES_DIR, file));
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = xlsx.utils.sheet_to_json(sheet);
                
                // Filtering repeated headers/junk
                const cleanData = data.filter(row => row.Date !== 'Date' && row.ISO_Date !== 'ISO_Date');

                stats.branches[branchName] = cleanData.length;

                for (const row of cleanData) {
                    stats.totals.reports++;
                    if (row.AI_Priority === 'CRITICAL') stats.totals.critical++;
                    
                    const cat = row.AI_Category || 'Unknown';
                    stats.categories[cat] = (stats.categories[cat] || 0) + 1;
                    
                    if (row.ISO_Date) {
                        try {
                            const rowDate = row.ISO_Date.split('T')[0];
                            const trendItem = stats.dailyTrend.find(t => t.date === rowDate);
                            if (trendItem) trendItem.count++;
                        } catch (e) {}
                    }

                    if (row.Train && row.Train !== 'N/A') {
                        const t = String(row.Train).trim().toUpperCase();
                        if (t.length > 0) {
                            trainCounts[t] = (trainCounts[t] || 0) + 1;
                        }
                    }
                }
            }
        }

        let maxTrain = { name: 'N/A', count: 0 };
        for (const [train, count] of Object.entries(trainCounts)) {
            if (count > maxTrain.count) maxTrain = { name: train, count };
        }
        stats.mostProblematicTrain = maxTrain;

        res.json(stats);

    } catch (e) {
        logger.error(`API Error: ${e.message}`);
        res.status(500).json({ error: "Failed to generate stats" });
    }
});

function startServer() {
    app.listen(PORT, () => {
        logger.info(`Web Dashboard running at http://localhost:${PORT}`);
    });
}

module.exports = { startServer, PORT };
