const { showMainMenu } = require('./main_menu');
const { forwardReport } = require('../utils/forwarder');
const config = require('../config');
const { InlineKeyboard } = require('grammy');

async function init(ctx) {
    ctx.session.step = 'gratitude';
    const text = ctx.t.gratitude.prompt || "Please write your gratitude:";
    const keyboard = new InlineKeyboard()
        .text("🔙 " + ctx.t.back, "btn_back")
        .text(ctx.t.btn_main_menu, "menu_main");

    try {
        await ctx.editMessageText(text, { reply_markup: keyboard });
    } catch (e) {
        await ctx.reply(text, { reply_markup: keyboard });
    }
}

async function handleMessage(ctx) {
    const text = ctx.message.text;

    // Gratitude is simple one-step text
    await forwardReport(ctx, config.CHAT_IDS.FILIAL, "GRATITUDE / БЛАГОДАРНОСТЬ", {
        "Message": text
    });

    await ctx.reply(ctx.t.gratitude.received);
    await showMainMenu(ctx);
}

module.exports = { init, handleMessage };
