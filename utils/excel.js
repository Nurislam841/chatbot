const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const REPORTS_DIR = path.join(__dirname, '../reports');
const BRANCHES_DIR = path.join(REPORTS_DIR, 'branches');

// Ensure directories exist
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);
if (!fs.existsSync(BRANCHES_DIR)) fs.mkdirSync(BRANCHES_DIR);

/**
 * Appends a new report row to the specific Excel file based on category AND branch.
 */
function logToExcel(data, category = 'general', branch = null) {
    try {
        const now = new Date();

        // Ensure consistent key order for Power BI
        const finalRow = {
            date_created: data.date_created || now.toISOString(),
            category: data.category || category,
            message_text: data.message_text || "",
            user_name: data.user_name || "",
            user_tag: data.user_tag || "",
            phone: data.phone || "",
            branch: data.branch || (branch ? branch : ""),
            cash_desk: data.cash_desk || "",
            train_number: data.train_number || "",
            wagon: data.wagon || "",
            seat: data.seat || "",
            status: data.status || "New",
            priority: data.priority || "",
            ai_summary: data.ai_summary || "",
            ai_recommendation: data.ai_recommendation || "",
            ai_risk: data.ai_risk || "",
            ai_sentiment: data.ai_sentiment || ""
        };

        // 1. Log to Category File (Global)
        writeToSheet(finalRow, path.join(REPORTS_DIR, `${sanitize(category)}.xlsx`), category);

        // 2. Log to Branch File (if branch is provided)
        if (branch) {
            writeToSheet(finalRow, path.join(BRANCHES_DIR, `${sanitize(branch)}.xlsx`), branch);
        }

    } catch (error) {
        logger.error(`Failed to log to Excel (${category}/${branch}): ${error.message}`);
    }
}

function sanitize(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/**
 * Robustly reads an Excel sheet and converts it to a clean array of objects.
 * Handles cases where headers might be duplicated or missing.
 */
function readCleanSheet(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // Use header: 1 to get array of arrays, avoiding __EMPTY_N property names
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) return [];

        const headers = rows[0];
        const data = [];

        for (let i = 1; i < rows.length; i++) {
            const rowValues = rows[i];
            if (!rowValues || rowValues.length === 0) continue;

            const obj = {};
            headers.forEach((header, index) => {
                if (header) {
                    obj[header] = rowValues[index];
                }
            });

            // Skip rows that look like repeated headers
            if (obj.Date === 'Date' || obj.Timestamp === 'Timestamp') continue;

            data.push(obj);
        }
        return data;
    } catch (e) {
        logger.error(`Read error ${filePath}: ${e.message}`);
        return [];
    }
}

function writeToSheet(row, filePath, logName) {
    try {
        let data = readCleanSheet(filePath);
        data.push(row);

        const newWorkbook = xlsx.utils.book_new();
        const newWorksheet = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Data');
        xlsx.writeFile(newWorkbook, filePath);

        logger.info(`Data logged to ${logName}.xlsx successfully.`);
    } catch (e) {
        logger.error(`Write error ${filePath}: ${e.message}`);
    }
}

async function getFilteredReport(category, startTime, endTime) {
    try {
        const safeName = sanitize(category);
        const filePath = path.join(REPORTS_DIR, `${safeName}.xlsx`);

        const data = readCleanSheet(filePath);
        if (data.length === 0) return null;

        const filteredData = data.filter(row => {
            let rowTime;
            if (row.Timestamp && typeof row.Timestamp === 'number') {
                rowTime = row.Timestamp;
            } else if (row.ISO_Date) {
                const parsed = new Date(row.ISO_Date);
                if (!isNaN(parsed.getTime())) rowTime = parsed.getTime();
                else return false;
            } else if (row.Date) {
                // Fallback for very old data
                const parsed = new Date(row.Date);
                if (!isNaN(parsed.getTime())) rowTime = parsed.getTime();
                else return false;
            } else {
                return false;
            }
            return rowTime >= startTime && rowTime <= endTime;
        });

        if (filteredData.length === 0) return null;

        const newWorkbook = xlsx.utils.book_new();
        const newWorksheet = xlsx.utils.json_to_sheet(filteredData);
        xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Filtered Report');

        return xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });
    } catch (error) {
        logger.error(`Failed to filter report (${category}): ${error.message}`);
        return null;
    }
}

module.exports = { logToExcel, getFilteredReport, readCleanSheet, REPORTS_DIR, BRANCHES_DIR };
