const config = require('../config');
const { getFilteredReport } = require('../utils/excel');
const { generateSummaryMatrix } = require('../utils/statistics');
const { REPORTS_DIR, BRANCHES_DIR } = require('../utils/excel');
const { InlineKeyboard, InputFile } = require('grammy');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const otplib = require('otplib');
const qrcode = require('qrcode');

const SECRET_FILE = path.join(REPORTS_DIR, '2fa_secret.txt');

function get2FASecret() {
    if (fs.existsSync(SECRET_FILE)) {
        return { secret: fs.readFileSync(SECRET_FILE, 'utf8').trim(), exists: true };
    }
    return { secret: null, exists: false };
}

function create2FASecret() {
    const secret = otplib.authenticator.generateSecret();
    fs.writeFileSync(SECRET_FILE, secret);
    return secret;
}

async function init(ctx) {
    if (ctx.session.isAdmin) {
        await showDashboard(ctx);
    } else {
        ctx.session.step = 'manager_login_pass';
        ctx.session.manager_attempts = 0;
        await ctx.reply("🔐 ADMIN LOGIN\nВведите пароль:");
    }
}

async function showDashboard(ctx) {
    ctx.session.step = 'manager_period';
    const text = "📊 ПАНЕЛЬ МЕНЕДЖЕРА\n\nВыберите период для отчетов:";

    const keyboard = new InlineKeyboard()
        .text("Сегодня", "admin_period_today").row()
        .text("За 12 часов", "admin_period_12h").row()
        .text("📥 СКАЧАТЬ ВСЮ БАЗУ (Excel)", "admin_all_data").row()
        .text("Выход / Logout", "admin_logout");

    await ctx.reply(text, { reply_markup: keyboard });
}

async function handleMessage(ctx) {
    const step = ctx.session.step;
    const text = ctx.message.text;
    if (!ctx.session.manager_attempts) ctx.session.manager_attempts = 0;

    if (step === 'manager_login_pass') {
        const inputHash = crypto.createHash('sha256').update(text).digest('hex');
        try { await ctx.deleteMessage(); } catch (e) { }

        if (inputHash === config.MANAGER_PASSWORD_HASH) {
            ctx.session.manager_attempts = 0;
            ctx.session.step = 'manager_login_2fa';

            let { secret, exists } = get2FASecret();
            if (!exists) {
                secret = create2FASecret();
                ctx.session.canShowQR = true; // Разрешаем показать QR только если мы его только что создали
            }

            let msg = "✅ Пароль верный.\nВведите 6-значный код из Google Authenticator:";
            if (ctx.session.canShowQR) {
                msg += "\n\n⚠️ Это новая настройка. Напишите слово QR, чтобы получить код.";
            }
            await ctx.reply(msg);
        } else {
            ctx.session.manager_attempts++;
            if (ctx.session.manager_attempts >= 3) {
                ctx.session.step = 'main_menu';
                return await ctx.reply("❌ Слишком много попыток. Доступ заблокирован.");
            }
            await ctx.reply(`❌ Неверный пароль. Попытка ${ctx.session.manager_attempts}/3`);
        }
    }
    else if (step === 'manager_login_2fa') {
        const { secret, exists } = get2FASecret();

        if (text.toUpperCase() === 'QR') {
            if (!ctx.session.canShowQR) {
                return await ctx.reply("⛔️ Безопасность: QR-код уже был настроен ранее. Если нужно сбросить — используйте спец-команду.");
            }
            const otpauth = otplib.authenticator.keyuri('Admin', 'KTZ_Bot', secret);
            const qrBuffer = await qrcode.toBuffer(otpauth);
            return await ctx.replyWithPhoto(new InputFile(qrBuffer), { caption: "Отсканируйте этот код и введите 6 цифр:" });
        }

        const isValid = otplib.authenticator.check(text, secret);
        if (isValid) {
            ctx.session.isAdmin = true;
            ctx.session.manager_attempts = 0;
            ctx.session.canShowQR = false; // Блокируем QR после успешного входа
            await ctx.reply("🔓 Доступ разрешен!");
            await showDashboard(ctx);
        } else {
            ctx.session.manager_attempts++;
            if (ctx.session.manager_attempts >= 3) {
                ctx.session.step = 'main_menu';
                ctx.session.canShowQR = false;
                return await ctx.reply("❌ Ошибка 2FA. Сессия аннулирована.");
            }
            await ctx.reply(`❌ Неверный код. Попытка ${ctx.session.manager_attempts}/3`);
        }
    }
}

async function handleCallback(ctx) {
    const data = ctx.callbackQuery.data;

    if (data === 'admin_logout') {
        ctx.session.isAdmin = false;
        ctx.session.step = 'main_menu';
        await ctx.answerCallbackQuery();
        await ctx.editMessageText("👋 Сессия завершена.");
        return;
    }

    if (!ctx.session.isAdmin) {
        await ctx.answerCallbackQuery({ text: "Сессия истекла.", show_alert: true });
        return;
    }

    if (data === 'admin_all_data') {
        await ctx.answerCallbackQuery("Выгрузка всей базы...");
        const { getReports } = require('../utils/db');
        const reports = await getReports({}); // No filters = all data
        if (reports.length > 0) {
            const buffer = generateExcelBuffer(reports);
            await ctx.replyWithDocument(new InputFile(buffer, `FULL_DATABASE_${new Date().toISOString().split('T')[0]}.xlsx`), {
                caption: "📥 Полная выгрузка всех данных из PostgreSQL"
            });
        } else {
            await ctx.reply("База данных пуста.");
        }
        return;
    }

    if (data.startsWith('admin_period_')) {
        const period = data.replace('admin_period_', '');
        ctx.session.data.manager_period = period;
        ctx.session.step = 'manager_category';

        const keyboard = new InlineKeyboard()
            .text("📊 СВОДНАЯ МАТРИЦА", "admin_stats_matrix").row()
            .text("📂 ПО ФИЛИАЛАМ", "admin_branch_list").row()
            .text("-------------------------", "noop").row()
            .text("Жалобы", "admin_cat_complaints").text("Билеты", "admin_cat_tickets").row()
            .text("Предложения", "admin_cat_suggestions").text("Забытые вещи", "admin_cat_lost_items").row()
            .text("🔙 Назад", "admin_back_period");

        await ctx.answerCallbackQuery();
        await ctx.editMessageText(`Период: ${period}. Выберите тип отчета:`, { reply_markup: keyboard });
    }

    else if (data === 'admin_back_period') {
        await showDashboard(ctx);
        await ctx.answerCallbackQuery();
    }

    else if (data === 'admin_stats_matrix') {
        const period = ctx.session.data.manager_period;
        await ctx.answerCallbackQuery("Генерация...");

        const { start, end } = getPeriodDates(period);
        // Use DB for stats
        const { getStatsMatrix } = require('../utils/db');
        const stats = await getStatsMatrix(start, end);

        if (stats && stats.length > 0) {
            const xlsx = require('xlsx');
            const wb = xlsx.utils.book_new();
            const ws = xlsx.utils.json_to_sheet(stats);
            xlsx.utils.book_append_sheet(wb, ws, "Matrix");
            const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

            await ctx.replyWithDocument(new InputFile(buffer, `Matrix_${period}.xlsx`), {
                caption: `Статистика (${period})`
            });
        } else {
            await ctx.reply("Нет данных в БД.");
        }
    }

    else if (data === 'admin_branch_list') {
        // Show branches from Config (since DB might be empty initially)
        const branches = Object.values(config.BRANCH_NAMES);
        // Unique branches
        const uniqueBranches = [...new Set(branches)];

        const keyboard = new InlineKeyboard();
        uniqueBranches.forEach(name => {
            // Clean name for callback
            keyboard.text(name, `admin_dl_branch_${name}`).row();
        });
        keyboard.text("Назад", "admin_back_period");

        await ctx.answerCallbackQuery();
        await ctx.editMessageText("Выберите филиал (из БД):", { reply_markup: keyboard });
    }

    else if (data.startsWith('admin_dl_branch_')) {
        const branchName = data.replace('admin_dl_branch_', '');
        await ctx.answerCallbackQuery("Загрузка из БД...");

        const { getReports } = require('../utils/db');
        const { start, end } = getPeriodDates(ctx.session.data.manager_period);
        const reports = await getReports({ branch: branchName, startDate: start, endDate: end });

        if (reports.length > 0) {
            const buffer = generateExcelBuffer(reports);
            await ctx.replyWithDocument(new InputFile(buffer, `${branchName}.xlsx`), { caption: `Филиал: ${branchName}` });
        } else {
            await ctx.reply("Нет данных за этот период.");
        }
    }

    else if (data.startsWith('admin_cat_')) {
        const category = data.replace('admin_cat_', '');
        const period = ctx.session.data.manager_period;
        await ctx.answerCallbackQuery("Загрузка из БД...");

        const { start, end } = getPeriodDates(period);
        const { getReports } = require('../utils/db');
        const reports = await getReports({ category: category, startDate: start, endDate: end });

        if (reports.length > 0) {
            const buffer = generateExcelBuffer(reports);
            const fileName = `${category}_${period}.xlsx`;
            await ctx.replyWithDocument(new InputFile(buffer, fileName), {
                caption: `Отчет: ${category} (${period})`
            });
        } else {
            await ctx.reply("Нет данных за этот период.");
        }
    }
}

function generateExcelBuffer(data) {
    const xlsx = require('xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, "Report");
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function getPeriodDates(period) {
    const now = new Date();
    const nowTime = now.getTime();
    let start = nowTime;

    if (period === 'today') {
        const almatyDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Almaty" }));
        almatyDate.setHours(0, 0, 0, 0);
        start = almatyDate.getTime();
    } else if (period === '1h') {
        start = nowTime - (60 * 60 * 1000);
    } else if (period === '12h') {
        start = nowTime - (12 * 60 * 60 * 1000);
    }
    return { start, end: nowTime };
}

async function reset2FA(ctx) {
    try {
        if (fs.existsSync(SECRET_FILE)) {
            fs.unlinkSync(SECRET_FILE);
            await ctx.reply("♻️ Секрет 2FA успешно сброшен. При следующем входе бот предложит настроить новый QR-код.");
        } else {
            await ctx.reply("ℹ️ Секрет 2FA не найден. Он и так сброшен или еще не создан.");
        }
    } catch (error) {
        await ctx.reply("❌ Ошибка при сбросе 2FA: " + error.message);
    }
}

module.exports = { init, handleCallback, handleMessage, reset2FA };
