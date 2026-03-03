const { InlineKeyboard } = require('grammy');

async function init(ctx, nextAction) {
    ctx.session.step = 'region_selection';

    // Store where the user wanted to go
    if (nextAction) {
        ctx.session.pending_callback = nextAction;
    }

    const keyboard = new InlineKeyboard()
        .text(ctx.t.btn_region_south, "region_select_south").text(ctx.t.btn_region_north, "region_select_north").row()
        .text(ctx.t.btn_region_center, "region_select_center").row()
        .text(ctx.t.btn_region_west, "region_select_west").text(ctx.t.btn_region_east, "region_select_east");

    const prompt = ctx.t.region_select_prompt || "Пожалуйста, выберите ваш филиал/регион (один раз):";

    try {
        await ctx.editMessageText(prompt, { reply_markup: keyboard });
    } catch (e) {
        await ctx.reply(prompt, { reply_markup: keyboard });
    }
}

async function handleCallback(ctx) {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('region_select_')) {
        const region = data.replace('region_select_', '');
        ctx.session.region = region;

        await ctx.answerCallbackQuery({ text: "Регион сохранен / Region saved" });

        // Resume pending action
        const nextAction = ctx.session.pending_callback;
        ctx.session.pending_callback = null; // Clear it

        if (nextAction) {
            // Re-trigger the router logic for the stored action
            // We can't directly call the router, but we can call the handler init functions manually
            // OR we can assign the data back to the context and let a helper (if we had one) handle it.
            // Be pragmatic: just switch on the known nextActions.

            if (nextAction === 'menu_gratitude') {
                const h = require('./gratitude'); await h.init(ctx);
            } else if (nextAction === 'menu_return_ticket') {
                const h = require('./return_ticket'); await h.init(ctx);
            } else if (nextAction === 'menu_complaint') {
                const h = require('./complaint'); await h.init(ctx);
            } else if (nextAction === 'menu_suggestion') {
                const h = require('./suggestion'); await h.init(ctx);
            } else if (nextAction === 'menu_lost_items') {
                const h = require('./lost_items'); await h.init(ctx);
            } else {
                // Fallback to main menu if unknown
                const h = require('./main_menu'); await h.showMainMenu(ctx);
            }
        } else {
            const h = require('./main_menu'); await h.showMainMenu(ctx);
        }
    }
}

module.exports = { init, handleCallback };
