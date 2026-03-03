const { showMainMenu } = require('./main_menu');
const { forwardReport } = require('../utils/forwarder');
const config = require('../config');
const { InlineKeyboard, Keyboard } = require('grammy');

async function init(ctx) {
    ctx.session.step = 'suggestion';
    const text = ctx.t.suggestion.prompt || "Please write your suggestion:";
    const keyboard = new InlineKeyboard()
        .text(ctx.t.btn_main_menu, "menu_main");

    try {
        await ctx.editMessageText(text, { reply_markup: keyboard });
    } catch (e) {
        await ctx.reply(text, { reply_markup: keyboard });
    }
}

async function handleCallback(ctx) {
    const data = ctx.callbackQuery.data;
    if (data === 'suggestion_skip_wizard') {
        const step = ctx.session.step;
        if (step === 'suggestion_wizard_train') {
            ctx.session.data.ticket_train = "Skipped";
            ctx.session.step = 'suggestion_wizard_wagon';
            const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "suggestion_skip_wizard");
            await ctx.editMessageText(ctx.t.ticket_wizard.wagon, { reply_markup: keyboard });
        } else if (step === 'suggestion_wizard_wagon') {
            ctx.session.data.ticket_wagon = "Skipped";
            ctx.session.step = 'suggestion_wizard_ticket';
            const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "suggestion_skip_wizard");
            await ctx.editMessageText(ctx.t.ticket_wizard.place, { reply_markup: keyboard });
        } else if (step === 'suggestion_wizard_ticket') {
            ctx.session.data.ticket_place = "Skipped";
            await askForContact(ctx);
        }
        return;
    }
}

async function handleMessage(ctx) {
    const step = ctx.session.step;
    const text = ctx.message.text;
    const contact = ctx.message.contact;

    if (text === ctx.t.btn_main_menu) {
        await showMainMenu(ctx);
        return;
    }

    if (step === 'suggestion') {
        ctx.session.data.suggestion_text = text;
        ctx.session.step = 'suggestion_wizard_train'; // Start Wizard
        const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "suggestion_skip_wizard");
        await ctx.reply(ctx.t.ticket_wizard.train, { reply_markup: keyboard });
    }
    // Wizard Step 1
    else if (step === 'suggestion_wizard_train') {
        ctx.session.data.ticket_train = text;
        ctx.session.step = 'suggestion_wizard_wagon';
        const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "suggestion_skip_wizard");
        await ctx.reply(ctx.t.ticket_wizard.wagon, { reply_markup: keyboard });
    }
    // Wizard Step 2
    else if (step === 'suggestion_wizard_wagon') {
        ctx.session.data.ticket_wagon = text;
        ctx.session.step = 'suggestion_wizard_ticket';
        const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "suggestion_skip_wizard");
        await ctx.reply(ctx.t.ticket_wizard.place, { reply_markup: keyboard });
    }
    // Wizard Step 3
    else if (step === 'suggestion_wizard_ticket') {
        ctx.session.data.ticket_place = text;
        await askForContact(ctx);
    }
    else if (step === 'suggestion_contact') {
        const phone = contact ? contact.phone_number : (text === ctx.t.btn_skip ? "Hidden/Skipped" : text);
        const suggestionText = ctx.session.data.suggestion_text;

        const train = ctx.session.data.ticket_train || "-";
        const wagon = ctx.session.data.ticket_wagon || "-";
        const place = ctx.session.data.ticket_place || "-";
        const ticketInfo = `Train: ${train}, Wagon: ${wagon}, Place: ${place}`;

        const aiResponse = await forwardReport(ctx, config.CHAT_IDS.PP_CA, "SUGGESTION / ПРЕДЛОЖЕНИЕ", {
            "Content": suggestionText,
            "Ticket/Train Info": ticketInfo,
            "Contact": phone
        });

        if (aiResponse) {
            await ctx.reply(aiResponse, { reply_markup: { remove_keyboard: true } });
        } else {
            await ctx.reply(ctx.t.suggestion.received, { reply_markup: { remove_keyboard: true } });
        }
        await showMainMenu(ctx);
    }
}

async function askForContact(ctx) {
    ctx.session.step = 'suggestion_contact';
    const kb = new Keyboard()
        .requestContact(ctx.t.btn_share_contact)
        .row()
        .text(ctx.t.btn_skip)
        .row()
        .text(ctx.t.btn_main_menu)
        .resized().oneTime();

    await ctx.reply(ctx.t.phone_prompt, { reply_markup: kb });
}

module.exports = { init, handleCallback, handleMessage };
