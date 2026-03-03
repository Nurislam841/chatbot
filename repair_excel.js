const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, 'reports');
const BRANCHES_DIR = path.join(REPORTS_DIR, 'branches');

function repairFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    console.log(`Repairing ${filePath}...`);

    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length === 0) return;

        // Find the "best" header row (the one with the most recognized keys)
        let headerRowIndex = 0;
        let maxKeys = 0;
        const recognized = ['Date', 'ISO_Date', 'Timestamp', 'Title', 'User', 'Details'];

        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const keys = rows[i].filter(k => recognized.includes(String(k).trim()));
            if (keys.length > maxKeys) {
                maxKeys = keys.length;
                headerRowIndex = i;
            }
        }

        const headers = rows[headerRowIndex].map(h => String(h).trim());
        const cleanData = [];

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const r = rows[i];
            if (!r || r.length === 0) continue;

            const obj = {};
            let hasData = false;
            headers.forEach((h, idx) => {
                if (h && r[idx] !== undefined) {
                    obj[h] = r[idx];
                    if (h !== 'Date' && h !== 'Timestamp') hasData = true;
                }
            });

            // Skip if it feels like a header repeat
            if (obj.Date === 'Date' || obj.Timestamp === 'Timestamp') continue;
            if (hasData) cleanData.push(obj);
        }

        if (cleanData.length > 0) {
            const newWb = xlsx.utils.book_new();
            const newWs = xlsx.utils.json_to_sheet(cleanData);
            xlsx.utils.book_append_sheet(newWb, newWs, 'Data');
            xlsx.writeFile(newWb, filePath);
            console.log(`✅ Fixed ${cleanData.length} rows.`);
        }
    } catch (e) {
        console.error(`❌ Error fixing ${filePath}: ${e.message}`);
    }
}

// 1. Repair Main Reports
if (fs.existsSync(REPORTS_DIR)) {
    fs.readdirSync(REPORTS_DIR).forEach(f => {
        if (f.endsWith('.xlsx')) repairFile(path.join(REPORTS_DIR, f));
    });
}

// 2. Repair Branch Reports
if (fs.existsSync(BRANCHES_DIR)) {
    fs.readdirSync(BRANCHES_DIR).forEach(f => {
        if (f.endsWith('.xlsx')) repairFile(path.join(BRANCHES_DIR, f));
    });
}

console.log('--- REPAIR COMPLETE ---');
