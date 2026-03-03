const { showMainMenu } = require('./main_menu');
const { forwardReport } = require('../utils/forwarder');
const config = require('../config');
const { InlineKeyboard } = require('grammy');

async function init(ctx) {
    ctx.session.step = 'return_ticket';
    const text = ctx.t.return_ticket.title || "Выберите действие:";

    const keyboard = new InlineKeyboard()
        .text(ctx.t.return_ticket.btn_status, "return_status").row()
        .text(ctx.t.return_ticket.btn_consultation, "return_consultation").row()
        .text("🔙 " + ctx.t.back, "btn_back")
        .text(ctx.t.btn_main_menu, "menu_main");

    try {
        await ctx.editMessageText(text, { reply_markup: keyboard });
    } catch (e) {
        await ctx.reply(text, { reply_markup: keyboard });
    }
}

async function handleCallback(ctx) {
    const data = ctx.callbackQuery.data;

    if (data === 'return_status') {
        ctx.session.step = 'return_ticket_number';
        const keyboard = new InlineKeyboard()
            .text("🔙 " + ctx.t.back, "menu_return_ticket")
            .text(ctx.t.btn_main_menu, "menu_main");
        await ctx.editMessageText(ctx.t.return_ticket.ticket_number_prompt, { reply_markup: keyboard });
    } else if (data === 'return_consultation') {
        ctx.session.step = 'return_ticket_consultation';
        const keyboard = new InlineKeyboard()
            .text("🔙 " + ctx.t.back, "menu_return_ticket")
            .text(ctx.t.btn_main_menu, "menu_main");
        await ctx.editMessageText(ctx.t.return_ticket.consultation_prompt, { reply_markup: keyboard });
    }
}

async function handleMessage(ctx) {
    const step = ctx.session.step;
    const text = ctx.message.text;

    if (step === 'return_ticket_number') {
        const kzHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Almaty', hour: 'numeric', hour12: false }));

        let targetId = null;
        if (kzHour >= 8 && kzHour < 12) targetId = config.CHAT_IDS.LVRS;
        else if (kzHour >= 12 && kzHour < 16) targetId = config.CHAT_IDS.LVRZ;
        else if (kzHour >= 16 && kzHour < 20) targetId = config.CHAT_IDS.LVRY;

        if (targetId) {
            await forwardReport(ctx, targetId, "RETURN TICKET STATUS / ВОЗВРАТ БИЛЕТА", {
                "Ticket Number": text
            });
            await ctx.reply(ctx.t.return_ticket.received);
        } else {
            await ctx.reply(ctx.t.return_ticket.time_error || "Service available 08:00 - 20:00.");
        }
        await showMainMenu(ctx);
    }
    else if (step === 'return_ticket_consultation') {
        await forwardReport(ctx, config.CHAT_IDS.FILIAL, "RETURN CONSULTATION / КОНСУЛЬТАЦИЯ ПО ВОЗВРАТУ", {
            "Question": text
        });
        await ctx.reply(ctx.t.return_ticket.received);
        await showMainMenu(ctx);
    }
}

module.exports = { init, handleCallback, handleMessage };
