require('dotenv').config();

const CHAT_IDS = {
    CPO: -1003872189399,   // Central Processing / Delay
    FILIAL: -1003807595026, // General Branch / Station
    KASSA: -1003754301346,  // Ticket Office

    // Regional Branches for Return Tickets
    LVRS: -1003788983597,   // Северный региональный филиал (Northern Regional Branch)
    LVRZ: -1003751801706,   // Западный региональный филиал (Western Regional Branch)
    LVRY: -1003865024493,   // Южный региональный филиал (Southern Regional Branch)

    // Other Branches
    LE: -1003590587799,     // Экспресс (Express)
    LPP: -1003860694387,    // Филиал Пригородные перевозки (Suburban Transportation)

    PP_CA: -1003860694387,  // Passenger Transportation (Example ID)

    // Placeholders or unused
    GC: -1003590587799,
    CZO: -1003872189399,
    CZI: -1003872189399,
    CPP: -1003872189399,
    PERO: -1003872189399,
    GOC: -1003872189399
};

// Map Chat IDs to Branch Names for File Logging
const BRANCH_NAMES = {
    [CHAT_IDS.LVRS]: "LVRS_NORTH",
    [CHAT_IDS.LVRZ]: "LVRZ_WEST",
    [CHAT_IDS.LVRY]: "LVRY_SOUTH",
    [CHAT_IDS.LE]: "LE_EXPRESS",
    [CHAT_IDS.LPP]: "LPP_SUBURBAN",
    [CHAT_IDS.CPO]: "CPO_CENTRAL",
    [CHAT_IDS.FILIAL]: "FILIAL_GENERAL",
    [CHAT_IDS.KASSA]: "KASSA_TICKETS"
};

module.exports = {
    CHAT_IDS,
    BRANCH_NAMES,
    ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID || -1003872189399,
    BOT_TOKEN: process.env.BOT_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    // Default Hash for "admin123" (SHA-256)
    MANAGER_PASSWORD_HASH: process.env.MANAGER_PASSWORD_HASH || "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
};
