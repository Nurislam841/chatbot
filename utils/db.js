const { Pool } = require('pg');
const logger = require('./logger');

// Database connection configuration
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'admin',
    host: process.env.POSTGRES_HOST || 'postgres', // Service name from docker-compose
    database: process.env.POSTGRES_DB || 'main_db',
    password: process.env.POSTGRES_PASSWORD || 'Perricheno2.7',
    port: process.env.POSTGRES_PORT || 5432,
});

// Create tables if they don't exist
const initDB = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                category VARCHAR(50),
                message_text TEXT,
                user_name VARCHAR(100),
                user_tag VARCHAR(100),
                phone VARCHAR(50),
                branch VARCHAR(50),
                cash_desk VARCHAR(50),
                train_number VARCHAR(50),
                wagon VARCHAR(50),
                seat VARCHAR(50),
                status VARCHAR(50) DEFAULT 'New',
                priority VARCHAR(50),
                ai_summary TEXT,
                ai_recommendation TEXT,
                ai_risk VARCHAR(50),
                ai_sentiment VARCHAR(50)
            );
        `);
        logger.info('Database initialized: "reports" table checked/created.');
    } catch (err) {
        logger.error(`Database initialization failed: ${err.message}`);
    } finally {
        client.release();
    }
};

// Save a new report
const saveReport = async (data) => {
    const query = `
        INSERT INTO reports (
            date_created, category, message_text, user_name, user_tag, phone, branch, 
            cash_desk, train_number, wagon, seat, status, priority, 
            ai_summary, ai_recommendation, ai_risk, ai_sentiment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id;
    `;
    const values = [
        data.date_created, data.category, data.message_text, data.user_name, data.user_tag, data.phone, data.branch,
        data.cash_desk, data.train_number, data.wagon, data.seat, data.status, data.priority,
        data.ai_summary, data.ai_recommendation, data.ai_risk, data.ai_sentiment
    ];

    try {
        logger.info(`Attempting to save report to DB: ${JSON.stringify(data)}`);
        const res = await pool.query(query, values);
        logger.info(`Report saved to DB with ID: ${res.rows[0].id}`);
        return res.rows[0].id;
    } catch (err) {
        logger.error(`Failed to save report to DB: ${err.message}`);
        console.error(err); // Force stdout
        throw err;
    }
};

// Get reports for export
const getReports = async (filters = {}) => {
    let query = 'SELECT * FROM reports WHERE 1=1';
    const values = [];
    let counter = 1;

    if (filters.category) {
        query += ` AND category = $${counter++}`;
        values.push(filters.category);
    }
    if (filters.branch) {
        query += ` AND branch = $${counter++}`;
        values.push(filters.branch);
    }
    if (filters.startDate) {
        query += ` AND date_created >= $${counter++}`;
        values.push(new Date(filters.startDate).toISOString());
    }
    if (filters.endDate) {
        query += ` AND date_created <= $${counter++}`;
        values.push(new Date(filters.endDate).toISOString());
    }

    query += ' ORDER BY date_created DESC';

    try {
        const res = await pool.query(query, values);
        return res.rows;
    } catch (err) {
        logger.error(`Failed to fetch reports: ${err.message}`);
        return [];
    }
};

// Generate Matrix Statistics (replacement for excel statistics)
const getStatsMatrix = async (startDate, endDate) => {
    // This is a simplified example. You might want complex aggregation here.
    // For now, let's just count by category and branch.
    const query = `
        SELECT category, branch, COUNT(*) as count 
        FROM reports 
        WHERE date_created >= $1 AND date_created <= $2
        GROUP BY category, branch
    `;

    try {
        const res = await pool.query(query, [new Date(startDate).toISOString(), new Date(endDate).toISOString()]);
        return res.rows;
    } catch (err) {
        logger.error(`Failed to get stats matrix: ${err.message}`);
        return [];
    }
}


module.exports = { pool, initDB, saveReport, getReports, getStatsMatrix };
