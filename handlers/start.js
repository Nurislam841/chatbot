const { InlineKeyboard } = require('grammy');
const { showMainMenu } = require('./main_menu');

module.exports = async (ctx) => {
    // 1. Send Welcome Message with Inline Keyboard for Language
    // We send this as a new message when /start is pressed.

    // We can't use ctx.t yet because language isn't selected, so we hardcode trilingual welcome.
    const text = "Қош келдіңіз! / Welcome! / Добро пожаловать!\n\nТілді таңдаңыз / Choose language / Выберите язык:";

    const keyboard = new InlineKeyboard()
        .text("🇰🇿 Қазақша", "lang_kz").row()
        .text("🇷🇺 Русский", "lang_ru").row()
        .text("🇬🇧 English", "lang_en");

    await ctx.reply(text, { reply_markup: keyboard });
    ctx.session.step = 'language_selection'; // Update step
};

// Helper to handle the callback (moved logic from old handleLanguageSelection to index.js router or here)
module.exports.handleLanguageCallback = async (ctx) => {
    const data = ctx.callbackQuery.data; // e.g., "lang_kz"

    if (data === 'lang_kz') ctx.session.language = 'kz';
    if (data === 'lang_ru') ctx.session.language = 'ru';
    if (data === 'lang_en') ctx.session.language = 'en';

    // Reload locale for current context immediately
    const locales = require('../locales');
    ctx.t = locales[ctx.session.language];

    await ctx.answerCallbackQuery(); // Stop the loading animation

    // Transition to Main Menu by EDITING the current message
    await showMainMenu(ctx, true);
};
