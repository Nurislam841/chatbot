const config = require('../config');
const { analyzeRequest, formatAIReport } = require('./ai');
const logger = require('./logger');
const { logToExcel } = require('./excel');

async function forwardReport(ctx, targetChatId, title, data) {
    const user = ctx.from;
    const username = user.username ? `@${user.username}` : 'No username';
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const userId = user.id;

    // 1. COMBINE DATA FOR AI ANALYSIS
    let fullTextToAnalyze = "";
    for (const [key, value] of Object.entries(data)) {
        fullTextToAnalyze += `${key}: ${value}\n`;
    }

    // 2. RUN AI ANALYSIS
    let aiOutput = null;
    let aiReportHtml = "";

    try {
        aiOutput = await analyzeRequest(fullTextToAnalyze + `\nUser Language: ${ctx.session.language}`, title);
        aiReportHtml = formatAIReport(aiOutput);
    } catch (e) {
        logger.error(`AI Analysis failed inside forwarder: ${e.message}`);
    }

    // 3. CONSTRUCT FINAL MESSAGE (Minimalist)
    let messageBody = `<b>${title}</b>\n`;

    if (aiOutput && aiOutput.summary.priority === 'CRITICAL') {
        messageBody = `!!! CRITICAL ALERT !!!\n` + messageBody;
    }

    messageBody += `\nUser: ${fullName} (${username})\n`;
    messageBody += `ID: <code>${userId}</code>\n`;
    messageBody += `Date: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}\n`;
    messageBody += aiReportHtml.replace(/[^\x00-\x7FА-Яа-яЁё]/g, ""); // Basic emoji filter for AI part if needed
    messageBody += `\nORIGINAL DATA:\n`;
    for (const [key, value] of Object.entries(data)) {
        messageBody += `- ${key}: ${value}\n`;
    }

    // 4. DETERMINE FILE CATEGORY & BRANCH
    // 4. DETERMINE FILE CATEGORY & BRANCH
    let fileCategory = 'general';
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('complaint') || lowerTitle.includes('жалоба')) fileCategory = 'complaints';
    else if (lowerTitle.includes('suggestion') || lowerTitle.includes('предложение')) fileCategory = 'suggestions';
    else if (lowerTitle.includes('gratitude') || lowerTitle.includes('благодарность')) fileCategory = 'gratitude';
    else if (lowerTitle.includes('lost') || lowerTitle.includes('забыт')) fileCategory = 'lost_items';
    else if (lowerTitle.includes('ticket') || lowerTitle.includes('билет')) fileCategory = 'tickets';

    // Determine Branch: Prioritize User Selection (Session), fallback to ChatID mapping
    let branchName = 'UNKNOWN';
    if (ctx.session.region) {
        // Map region codes to full names if needed, or just use the code
        // Codes: south, north, east, west, center
        branchName = ctx.session.region.toUpperCase();
    } else {
        branchName = config.BRANCH_NAMES[targetChatId] || 'OTHER_BRANCH';
    }

    // 5. PREPARE EXCEL DATA (Power BI Schema)
    const excelData = {
        date_created: new Date().toISOString(),
        category: fileCategory, // category
        message_text: data.Details || data.Content || data.Message || data.Question || "No text",
        user_name: fullName,
        user_tag: username,
        phone: data.Contact || "",
        branch: branchName,
        cash_desk: data.CashDesk || "",

        train_number: data.Train || (aiOutput ? aiOutput.train_number : ''),
        wagon: data.Wagon || (aiOutput ? aiOutput.wagon_number : ''),
        seat: data.Place || "",

        status: "New",
        priority: aiOutput ? aiOutput.summary.priority : 'N/A',
        ai_summary: aiOutput ? aiOutput.summary.essence : 'N/A',
        ai_recommendation: (aiOutput && aiOutput.suggestion) ? aiOutput.suggestion.recommendation : 'N/A',
        ai_risk: aiOutput ? aiOutput.summary.risk : 'N/A',
        ai_sentiment: aiOutput ? aiOutput.sentiment : 'N/A'
    };

    // SAVE TO DB (PostgreSQL)
    const { saveReport } = require('./db');
    saveReport(excelData).catch(err => logger.error(`DB Save Failed: ${err.message}`));

    // Log to Excel (Legacy/Backup)
    logToExcel(excelData, fileCategory, branchName);

    // 6. SEND TO GROUP (Skip if it's Gratitude)
    try {
        const isGratitude = lowerTitle.includes('gratitude') || lowerTitle.includes('благодарность');

        if (!isGratitude) {
            await ctx.api.sendMessage(targetChatId, messageBody, { parse_mode: 'HTML' });
            logger.info(`Report forwarded to ${targetChatId} (${branchName})`);

            if (aiOutput && aiOutput.summary.priority === 'CRITICAL' && targetChatId !== config.ADMIN_CHAT_ID) {
                await ctx.api.sendMessage(config.ADMIN_CHAT_ID, `🚨 <b>AUTO-ESCALATED REPORT</b> 🚨\n\n` + messageBody, { parse_mode: 'HTML' });
            }
        } else {
            logger.info(`Gratitude logged locally, skipping group notification per requirements.`);
        }
    } catch (error) {
        logger.error(`Failed to forward report to ${targetChatId}: ${error.message}`);
        // Only notify admin if it wasn't the admin chat itself
        if (targetChatId !== config.ADMIN_CHAT_ID) {
            try {
                await ctx.api.sendMessage(config.ADMIN_CHAT_ID, `FAILED TO FORWARD TO ${targetChatId}\n\n` + messageBody, { parse_mode: 'HTML' });
            } catch (e) { }
        }
    }

    if (aiOutput && aiOutput.suggestion && aiOutput.suggestion.response_to_passenger) {
        return aiOutput.suggestion.response_to_passenger;
    } else if (aiOutput && aiOutput.response_to_passenger) {
        // Fallback for old AI prompt
        return aiOutput.response_to_passenger;
    }
    return null;
}

module.exports = { forwardReport };
