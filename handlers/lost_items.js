const { showMainMenu } = require('./main_menu');
const { forwardReport } = require('../utils/forwarder');
const config = require('../config');
const { InlineKeyboard } = require('grammy');

async function init(ctx) {
    // Start Wizard
    ctx.session.step = 'lost_items_train';
    const text = ctx.t.lost_items.prompt_train || "Train Number:";
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
    const step = ctx.session.step;
    const text = ctx.message.text;

    // Wizard Flow: Train -> Wagon -> Place -> Description -> Finish
    // Note: We are using messages for input, so we use ctx.reply for next steps.

    if (text === ctx.t.btn_main_menu) {
        await showMainMenu(ctx);
        return;
    }

    if (step === 'lost_items_train') {
        ctx.session.data.lost_train = text;
        ctx.session.step = 'lost_items_wagon';

        const keyboard = new InlineKeyboard().text(ctx.t.btn_main_menu, "menu_main");
        await ctx.reply(ctx.t.lost_items.prompt_wagon, { reply_markup: keyboard });

    } else if (step === 'lost_items_wagon') {
        ctx.session.data.lost_wagon = text;
        ctx.session.step = 'lost_items_place';

        const keyboard = new InlineKeyboard().text(ctx.t.btn_main_menu, "menu_main");
        await ctx.reply(ctx.t.lost_items.prompt_place, { reply_markup: keyboard });

    } else if (step === 'lost_items_place') {
        ctx.session.data.lost_place = text;
        ctx.session.step = 'lost_items_desc';

        const keyboard = new InlineKeyboard().text(ctx.t.btn_main_menu, "menu_main");
        await ctx.reply(ctx.t.lost_items.prompt_desc, { reply_markup: keyboard });

    } else if (step === 'lost_items_desc') {
        ctx.session.data.lost_desc = text;

        // Compile Data
        const data = {
            "Train": ctx.session.data.lost_train,
            "Wagon": ctx.session.data.lost_wagon,
            "Place": ctx.session.data.lost_place,
            "Description": ctx.session.data.lost_desc
        };

        await forwardReport(ctx, config.CHAT_IDS.FILIAL, "LOST ITEM / ЗАБЫТЫЕ ВЕЩИ", data);
        await ctx.reply(ctx.t.lost_items.received);
        await showMainMenu(ctx);
    }
}

module.exports = { init, handleMessage };
