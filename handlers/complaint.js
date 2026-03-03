const { showMainMenu } = require('./main_menu');
const { forwardReport } = require('../utils/forwarder');
const config = require('../config');
const { InlineKeyboard, Keyboard } = require('grammy');

// 1. INIT: Show Complaint Category Menu
async function init(ctx) {
    ctx.session.step = 'complaint_category';

    const text = ctx.t.complaint.title || "Выберите категорию жалобы:";

    const keyboard = new InlineKeyboard()
        .text(ctx.t.complaint.kategorii.delay, "complaint_delay").row()
        .text(ctx.t.complaint.kategorii.workers, "complaint_workers").row()
        .text(ctx.t.complaint.kategorii.sanitary, "complaint_sanitary").row()
        .text(ctx.t.complaint.kategorii.service, "complaint_service").row()
        .text(ctx.t.complaint.kategorii.other, "complaint_other").row()
        .text(ctx.t.btn_main_menu, "menu_main");

    try {
        await ctx.editMessageText(text, { reply_markup: keyboard });
    } catch (e) {
        await ctx.reply(text, { reply_markup: keyboard });
    }
}

// 2. HANDLE CALLBACKS (Button Clicks)
async function handleCallback(ctx) {
    const data = ctx.callbackQuery.data;

    // Sub-menu for Workers
    if (data === 'complaint_workers') {
        const sub = ctx.t.complaint.workers_sub;
        const keyboard = new InlineKeyboard()
            .text(sub.brigade, "complaint_workers_brigade").row()
            .text(sub.cashier, "complaint_workers_cashier").row()
            .text(sub.other, "complaint_workers_other").row()
            .text("🔙 " + ctx.t.back, "menu_complaint")
            .text(ctx.t.btn_main_menu, "menu_main");

        await ctx.editMessageText(sub.title, { reply_markup: keyboard });
        return;
    }

    // Ticket info skip (Wizard)
    if (data === 'complaint_skip_wizard') {
        const step = ctx.session.step;

        if (step === 'complaint_wizard_train') {
            ctx.session.data.ticket_train = "Skipped";
            ctx.session.step = 'complaint_wizard_wagon';
            const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "complaint_skip_wizard");
            await ctx.editMessageText(ctx.t.ticket_wizard.wagon, { reply_markup: keyboard });
        }
        else if (step === 'complaint_wizard_wagon') {
            ctx.session.data.ticket_wagon = "Skipped";
            ctx.session.step = 'complaint_wizard_ticket';
            const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "complaint_skip_wizard");
            await ctx.editMessageText(ctx.t.ticket_wizard.place, { reply_markup: keyboard });
        }
        else if (step === 'complaint_wizard_ticket') {
            ctx.session.data.ticket_place = "Skipped";
            // Finish wizard, go to contact
            await askForContact(ctx);
        }
        return;
    }

    // Input Prompts for Categories
    let promptStep = null;
    let promptText = "";

    if (data === 'complaint_delay') {
        promptStep = 'complaint_delay';
        promptText = ctx.t.complaint.delay_prompt;
    } else if (data === 'complaint_sanitary') {
        promptStep = 'complaint_sanitary';
        promptText = ctx.t.complaint.sanitary_prompt;
    } else if (data === 'complaint_service') {
        promptStep = 'complaint_service';
        promptText = ctx.t.complaint.service_prompt;
    } else if (data === 'complaint_other') {
        promptStep = 'complaint_other';
        promptText = ctx.t.complaint.other_prompt;
    } else if (data.startsWith('complaint_workers_')) {
        promptStep = data; // e.g. complaint_workers_brigade
        promptText = ctx.t.complaint.worker_prompt;
    }

    if (promptStep) {
        ctx.session.step = promptStep;
        const keyboard = new InlineKeyboard()
            .text("🔙 " + ctx.t.back, "menu_complaint")
            .text(ctx.t.btn_main_menu, "menu_main");
        await ctx.editMessageText(promptText, { reply_markup: keyboard });
    }
}

async function askForContact(ctx) {
    ctx.session.step = 'complaint_contact';
    const kb = new Keyboard()
        .requestContact(ctx.t.btn_share_contact)
        .row()
        .text(ctx.t.btn_skip)
        .row()
        .text(ctx.t.btn_main_menu)
        .resized().oneTime();

    await ctx.reply(ctx.t.phone_prompt, { reply_markup: kb });
}

// 3. HANDLE MESSAGES (Text Input)
async function handleMessage(ctx) {
    const step = ctx.session.step;
    const text = ctx.message.text;
    const contact = ctx.message.contact;

    if (text === ctx.t.btn_main_menu) {
        await showMainMenu(ctx);
        return;
    }

    // Step A: Capture Complaint Details -> Start Wizard (Train)
    if (['complaint_delay', 'complaint_sanitary', 'complaint_service', 'complaint_other'].includes(step) || step.startsWith('complaint_workers_')) {
        ctx.session.data.complaint_text = text;
        ctx.session.data.complaint_type = step;

        ctx.session.step = 'complaint_wizard_train';
        const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "complaint_skip_wizard");

        await ctx.reply(ctx.t.ticket_wizard.train, { reply_markup: keyboard });
    }

    // Wizard Step 1: Train -> Wagon
    else if (step === 'complaint_wizard_train') {
        ctx.session.data.ticket_train = text;
        ctx.session.step = 'complaint_wizard_wagon';
        const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "complaint_skip_wizard");
        await ctx.reply(ctx.t.ticket_wizard.wagon, { reply_markup: keyboard });
    }

    // Wizard Step 2: Wagon -> Ticket/Place
    else if (step === 'complaint_wizard_wagon') {
        ctx.session.data.ticket_wagon = text;
        ctx.session.step = 'complaint_wizard_ticket';
        const keyboard = new InlineKeyboard().text(ctx.t.ticket_wizard.skip, "complaint_skip_wizard");
        await ctx.reply(ctx.t.ticket_wizard.place, { reply_markup: keyboard });
    }

    // Wizard Step 3: Ticket -> Contact
    else if (step === 'complaint_wizard_ticket') {
        ctx.session.data.ticket_place = text;
        await askForContact(ctx);
    }

    // Step C: Capture Contact -> Forward Report
    else if (step === 'complaint_contact') {
        const phone = contact ? contact.phone_number : (text === ctx.t.btn_skip ? "Hidden/Skipped" : text);
        const typeStep = ctx.session.data.complaint_type;
        const complaintText = ctx.session.data.complaint_text;

        // Construct Ticket Info from Wizard Data
        const train = ctx.session.data.ticket_train || "-";
        const wagon = ctx.session.data.ticket_wagon || "-";
        const place = ctx.session.data.ticket_place || "-";
        const ticketInfo = `Train: ${train}, Wagon: ${wagon}, Place: ${place}`;

        let target = config.CHAT_IDS.FILIAL;
        let title = "COMPLAINT";

        if (typeStep === 'complaint_delay') { target = config.CHAT_IDS.CPO; title = "COMPLAINT: DELAY"; }
        else if (typeStep === 'complaint_sanitary') { title = "COMPLAINT: SANITARY"; }
        else if (typeStep === 'complaint_service') { title = "COMPLAINT: SERVICE"; }
        else if (typeStep === 'complaint_other') { target = config.CHAT_IDS.PP_CA; title = "COMPLAINT: OTHER"; }
        else if (typeStep.includes('workers')) {
            title = "COMPLAINT: WORKER";
            if (typeStep.includes('cashier')) target = config.CHAT_IDS.KASSA;
        }

        const aiResponse = await forwardReport(ctx, target, title, {
            "Details": complaintText,
            "Ticket/Train Info": ticketInfo,
            "Contact": phone
        });

        if (aiResponse) {
            await ctx.reply(aiResponse, { reply_markup: { remove_keyboard: true } });
        } else {
            await ctx.reply(ctx.t.complaint.received, { reply_markup: { remove_keyboard: true } });
        }

        await showMainMenu(ctx, false);
    }
}


module.exports = { init, handleCallback, handleMessage };
