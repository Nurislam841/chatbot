const { InlineKeyboard } = require('grammy');

async function showMainMenu(ctx, isEdit = false) {
    // Reset step to main_menu
    ctx.session.step = 'main_menu';

    const text = ctx.t.main_menu_title || "Главное меню / Main Menu";

    // Crypto-bot style: Cleaner layout
    // 1. Gratitude | 2. Return Ticket
    // 3. Complaint | 4. Suggestion
    // 5. Lost Items

    const keyboard = new InlineKeyboard()
        .text(ctx.t.btn_gratitude, "menu_gratitude").text(ctx.t.btn_return_ticket, "menu_return_ticket").row()
        .text(ctx.t.btn_complaint, "menu_complaint").text(ctx.t.btn_suggestion, "menu_suggestion").row()
        .text(ctx.t.btn_lost_items, "menu_lost_items");

    if (isEdit) {
        try {
            await ctx.editMessageText(text, { reply_markup: keyboard });
        } catch (e) {
            // If edit fails (e.g. message too old), send new
            await ctx.reply(text, { reply_markup: keyboard });
        }
    } else {
        await ctx.reply(text, { reply_markup: keyboard });
    }
}

module.exports = { showMainMenu };
module.exports.default = async (ctx) => {
    await showMainMenu(ctx, false);
};
