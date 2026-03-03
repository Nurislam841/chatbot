const { Bot, session, GrammyError, HttpError } = require('grammy');
require('dotenv').config();
const config = require('./config');
const locales = require('./locales');

const logger = require('./utils/logger');

const bot = new Bot(config.BOT_TOKEN);

// Session setup
function initial() {
    return {
        step: 'language',
        data: {},
        language: 'ru'
    };
}
bot.use(session({ initial }));

// Middleware to attach locale to ctx
bot.use(async (ctx, next) => {
    if (ctx.session && ctx.session.language) {
        ctx.t = locales[ctx.session.language];
    } else {
        ctx.t = locales['ru'];
    }
    await next();
});

const startHandler = require('./handlers/start');
const mainMenuHandler = require('./handlers/main_menu');
const managerHandler = require('./handlers/manager');
const regionHandler = require('./handlers/region');

// Command handlers
bot.command('start', startHandler);
bot.command('admin', (ctx) => managerHandler.init(ctx));
// Secret command for 2FA reset (SHA256 of admin123)
bot.hears(/^\/240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9/i, (ctx) => managerHandler.reset2FA(ctx));

// ==========================================
// CENTRAL CALLBACK ROUTER
// ==========================================
bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    logger.info(`Callback: ${data} from ${ctx.from.id}`);

    try {
        // Admin / Manager Flow
        if (data.startsWith('admin_')) {
            await managerHandler.handleCallback(ctx);
            return;
        }

        // 1. Language Selection
        if (data.startsWith('lang_')) {
            await startHandler.handleLanguageCallback(ctx);
            return;
        }

        // 2. Main Menu Navigation
        if (data === 'menu_main') {
            await mainMenuHandler.showMainMenu(ctx, true);
            return;
        }

        // 2.1 Region Selection Callback
        if (data.startsWith('region_select_')) {
            await regionHandler.handleCallback(ctx);
            return;
        }

        // 3. Menu Flow Routing (Intercept for Region)
        if (['menu_gratitude', 'menu_return_ticket', 'menu_complaint', 'menu_suggestion', 'menu_lost_items'].includes(data)) {

            // If region is not set, force selection
            if (!ctx.session.region) {
                await regionHandler.init(ctx, data);
                await ctx.answerCallbackQuery();
                return;
            }

            // Otherwise proceed as normal
            if (data === 'menu_gratitude') {
                const h = require('./handlers/gratitude'); await h.init(ctx);
            }
            else if (data === 'menu_return_ticket') {
                const h = require('./handlers/return_ticket'); await h.init(ctx);
            }
            else if (data === 'menu_complaint') {
                const h = require('./handlers/complaint'); await h.init(ctx);
            }
            else if (data === 'menu_suggestion') {
                const h = require('./handlers/suggestion'); await h.init(ctx);
            }
            else if (data === 'menu_lost_items') {
                const h = require('./handlers/lost_items'); await h.init(ctx);
            }
            return;
        }

        // 4. Sub-menu callbacks (delegated to handlers)
        else if (data.startsWith('complaint_')) {
            const complaintHandler = require('./handlers/complaint');
            await complaintHandler.handleCallback(ctx);
        }
        else if (data.startsWith('suggestion_')) {
            const suggestionHandler = require('./handlers/suggestion');
            await suggestionHandler.handleCallback(ctx);
        }
        else if (data.startsWith('return_')) {
            const returnHandler = require('./handlers/return_ticket');
            await returnHandler.handleCallback(ctx);
        }

        // 5. Back Button (Global)
        else if (data === 'btn_back') {
            await mainMenuHandler.showMainMenu(ctx, true);
        }

        await ctx.answerCallbackQuery();

    } catch (err) {
        logger.error(`Callback Error: ${err.message}`);
        await ctx.answerCallbackQuery({ text: "Error processing request" });
    }
});


// Global error handler
bot.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        logger.error(`Error in middleware: ${err.message}`);
    }
});

// Message handler routing based on session step (Text Inputs)
bot.on('message', async (ctx) => {
    const step = ctx.session.step;

    // If it's a command, skip
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;

    try {
        if (step.startsWith('gratitude')) {
            const gratitudeHandler = require('./handlers/gratitude');
            await gratitudeHandler.handleMessage(ctx);
        } else if (step.startsWith('lost_items')) {
            const lostItemsHandler = require('./handlers/lost_items');
            await lostItemsHandler.handleMessage(ctx);
        } else if (step.startsWith('return_ticket')) {
            const returnTicketHandler = require('./handlers/return_ticket');
            await returnTicketHandler.handleMessage(ctx);
        } else if (step.startsWith('suggestion')) {
            const suggestionHandler = require('./handlers/suggestion');
            await suggestionHandler.handleMessage(ctx);
        } else if (step.startsWith('complaint')) {
            const complaintHandler = require('./handlers/complaint');
            await complaintHandler.handleMessage(ctx);
        } else if (step.startsWith('manager_login')) {
            await managerHandler.handleMessage(ctx);
        } else {
            // If unknown step or just chatting, maybe show menu?
            // But we don't want to spam menu on every message.
            // Let's just log.
            logger.warn(`Message received in unknown step: ${step}`);
        }
    } catch (err) {
        logger.error(`Error handling message: ${err.message}`);
    }
});

bot.catch((err) => {
    const ctx = err.ctx;
    logger.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        logger.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
        logger.error("Could not contact Telegram:", e);
    } else {
        logger.error("Unknown error:", e);
    }
});

logger.info('Starting bot...');
bot.start({
    onStart: (botInfo) => {
        logger.info(`Bot @${botInfo.username} started!`);
    }
});

// ==========================================
// HTTP SERVER (For Power BI / External Access)
// ==========================================
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve the reports directory statically
const REPORTS_DIR = path.join(__dirname, 'reports');
app.use('/reports', express.static(REPORTS_DIR));

// Simple health check
app.get('/', (req, res) => {
    res.send('KTZ Bot Data Server is Running. Access reports at /reports/filename.xlsx');
});

const PORT = 8899;
app.listen(PORT, () => {
    logger.info(`HTTP Server running on port ${PORT}. Reports available at /reports/`);
});

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
