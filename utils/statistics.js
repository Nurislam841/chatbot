const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { REPORTS_DIR, BRANCHES_DIR, readCleanSheet } = require('./excel');
const logger = require('./logger');

/**
 * Generates a Summary Matrix Report.
 * Rows: Branches -> Train Numbers
 * Columns: Impact Categories (Gratitude, Lost, Complaints...)
 */
async function generateSummaryMatrix(startTime, endTime) {
    try {
        // 1. Definition of Metrics to Count
        const METRICS = {
            'gratitude': (row) => row.Title && row.Title.includes('GRATITUDE'),
            'lost_items': (row) => row.Title && row.Title.includes('LOST ITEM'),
            'complaint_brigade': (row) => (row.AI_Category === 'Сотрудники' || (row.Title && row.Title.includes('WORKER'))),
            'complaint_service': (row) => (row.AI_Category === 'Сервис' || (row.Title && row.Title.includes('SERVICE'))),
            'complaint_sanitary': (row) => (row.AI_Category === 'Санитария' || (row.Title && row.Title.includes('SANITARY'))),
            'complaint_delay': (row) => (row.AI_Category === 'Опоздание' || (row.Title && row.Title.includes('DELAY'))),
            'complaint_other': (row) => (row.AI_Category === 'Другое' || (row.Title && row.Title.includes('OTHER'))),
            'total': () => true
        };

        const metricKeys = Object.keys(METRICS);

        // 2. Scan Branch Files
        if (!fs.existsSync(BRANCHES_DIR)) return null;
        const branchFiles = fs.readdirSync(BRANCHES_DIR).filter(f => f.endsWith('.xlsx'));

        const stats = {};

        for (const file of branchFiles) {
            const branchName = file.replace('.xlsx', '');
            if (!stats[branchName]) stats[branchName] = {};

            const data = readCleanSheet(path.join(BRANCHES_DIR, file));

            // Filter by Date
            const filtered = data.filter(row => {
                let rowTime = row.Timestamp;
                if (!rowTime && row.ISO_Date) rowTime = new Date(row.ISO_Date).getTime();
                if (!rowTime && row.Date) rowTime = new Date(row.Date).getTime();
                return rowTime >= startTime && rowTime <= endTime;
            });

            // Process Rows
            for (const row of filtered) {
                let trainKey = row.Train ? String(row.Train).trim().toUpperCase() : 'NO_TRAIN_INFO';
                if (trainKey === '' || trainKey === 'UNDEFINED') trainKey = 'NO_TRAIN_INFO';

                if (!stats[branchName]['__TOTAL__']) {
                    stats[branchName]['__TOTAL__'] = {};
                    metricKeys.forEach(k => stats[branchName]['__TOTAL__'][k] = 0);
                }

                if (!stats[branchName][trainKey]) {
                    stats[branchName][trainKey] = {};
                    metricKeys.forEach(k => stats[branchName][trainKey][k] = 0);
                }

                metricKeys.forEach(key => {
                    if (METRICS[key](row)) {
                        stats[branchName][trainKey][key]++;
                        stats[branchName]['__TOTAL__'][key]++;
                    }
                });
            }
        }

        // 3. Build Excel Matrix
        // Columns: [Branch/Train, Gratitude, Lost, ..., Total]
        const outputData = [];

        for (const [branch, trains] of Object.entries(stats)) {
            // Branch Total Row
            const branchTotal = trains['__TOTAL__'];
            if (!branchTotal) continue; // Skip empty branches

            outputData.push({
                "Entity": `FILIAL: ${branch.toUpperCase()}`,
                "Gratitude": branchTotal.gratitude,
                "Lost Items": branchTotal.lost_items,
                "Complaints (Brigade)": branchTotal.complaint_brigade,
                "Complaints (Service)": branchTotal.complaint_service,
                "Complaints (Sanitary)": branchTotal.complaint_sanitary,
                "Complaints (Delay)": branchTotal.complaint_delay,
                "Complaints (Other)": branchTotal.complaint_other,
                "TOTAL": branchTotal.total
            });

            // Train Rows
            for (const [train, counts] of Object.entries(trains)) {
                if (train === '__TOTAL__') continue;
                outputData.push({
                    "Entity": `   Train ${train}`, // Indent for visual hierarchy
                    "Gratitude": counts.gratitude,
                    "Lost Items": counts.lost_items,
                    "Complaints (Brigade)": counts.complaint_brigade,
                    "Complaints (Service)": counts.complaint_service,
                    "Complaints (Sanitary)": counts.complaint_sanitary,
                    "Complaints (Delay)": counts.complaint_delay,
                    "Complaints (Other)": counts.complaint_other,
                    "TOTAL": counts.total
                });
            }
            // Spacer row
            outputData.push({});
        }

        const newWorkbook = xlsx.utils.book_new();
        const newWorksheet = xlsx.utils.json_to_sheet(outputData);
        xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Summary Matrix');

        return xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    } catch (e) {
        logger.error(`Statistics Generation Failed: ${e.message}`);
        return null;
    }
}

module.exports = { generateSummaryMatrix };
