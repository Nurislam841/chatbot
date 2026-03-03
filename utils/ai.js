const OpenAI = require('openai');
const config = require('../config');
const logger = require('./logger');

const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});

/**
 * Analyzes the user request using OpenAI to extract structured data.
 * @param {string} text - The user's message text.
 * @param {string} context - The context (e.g., "Complaint about delays").
 * @returns {Promise<object>} - structured data.
 */
async function analyzeRequest(text, context = 'General Inquiry') {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cost-effective and fast
            messages: [
                {
                    role: "system",
                    content: `You are an AI Intake & Decision Engine for "АО КТЖ" (Kazakhstan Railways).
Your goal is to transform passenger chaos into structured management decisions.

Analyze the incoming message (Language: RU/KZ/EN) and produce a JSON object with:
1. "summary":
   - "essence": Short subject (3-5 words).
   - "reason": Root cause of the issue.
   - "risk": Potential risk (Safety, Reputation, Financial, None).
   - "category": Logical category (Service, Technical, Personnel, Safety, etc.).
   - "priority": LOW, MEDIUM, HIGH, or CRITICAL.
   - "value": Business impact description.
2. "routing":
   - "suggested_department": Suggest a department (CPO, FILIAL, SECURITY, SERVICE, TECHNICAL).
   - "is_safety_threat": boolean (True if threat to life/health/safety).
   - "is_conflict": boolean (True if aggressive behavior/conflict).
3. "suggestion":
   - "response_to_passenger": Polite, empathetic response to the user.
   - "recommendation": Actionable advice for the manager (e.g., "Check turnstile", "Refund ticket", "Send repair team").
4. "sentiment": "positive", "neutral", "negative", "aggressive".
5. "train_number": string or null.
6. "wagon_number": string or null.

Output strictly JSON.
IMPORTANT: The values for "essence", "reason", "risk", "category", "recommendation" MUST be in RUSSIAN (Cyrillic).`
                },
                {
                    role: "user",
                    content: `Context: ${context}\nMessage: "${text}"`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1, // low temperature for deterministic output
        });

        const content = response.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        logger.error(`AI Analysis Failed: ${error.message}`);
        // Fallback structure in case of AI failure
        return {
            summary: {
                essence: "AI Processing Failed",
                reason: "Check logs",
                risk: "Unknown",
                category: "Uncategorized",
                priority: "MEDIUM" // Default to medium to be safe
            },
            routing: { is_safety_threat: false, is_conflict: false },
            sentiment: "neutral"
        };
    }
}

/**
 * Formats the AI analysis into a readable string for the report.
 * @param {object} analysis - The JSON output from analyzeRequest
 * @returns {string} - Formatted HTML string
 */
function formatAIReport(analysis) {
    const s = analysis.summary;
    const r = analysis.routing;

    let priorityIcon = '🟢';
    if (s.priority === 'MEDIUM') priorityIcon = '🟡';
    if (s.priority === 'HIGH') priorityIcon = '🔴';
    if (s.priority === 'CRITICAL') priorityIcon = '🚨';

    let html = `\n<b>🤖 AI DECISION ENGINE</b>\n`;
    html += `${priorityIcon} <b>Priority:</b> ${s.priority}\n`;
    html += `📝 <b>Essence:</b> ${s.essence}\n`;
    html += `🔍 <b>Reason:</b> ${s.reason}\n`;
    html += `⚠️ <b>Risk:</b> ${s.risk}\n`;
    html += `📂 <b>Category:</b> ${s.category}\n`;
    // html += `💡 <b>Value:</b> ${s.value}\n`; // Maybe too verbose for chat? Let's keep it brief.

    if (r.is_safety_threat) html += `\n⛔ <b>SAFETY THREAT DETECTED!</b>`;
    if (r.is_conflict) html += `\n💢 <b>CONFLICT DETECTED!</b>`;

    html += `\n🧠 <b>Sentiment:</b> ${analysis.sentiment.toUpperCase()}\n`;

    return html;
}

module.exports = { analyzeRequest, formatAIReport };
