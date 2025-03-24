require('dotenv').config();
const { Pool } = require('pg');

async function createDatabase() {
    // First connect to 'postgres' database to create our new database
    const pool = new Pool({
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: 'postgres', // Connect to default database first
        password: process.env.POSTGRES_PASSWORD,
        port: process.env.POSTGRES_PORT,
    });

    try {
        // Create the database if it doesn't exist
        await pool.query(`
            CREATE DATABASE ${process.env.POSTGRES_DB}
        `).catch(err => {
            if (err.code === '42P04') {
                console.log(`Database ${process.env.POSTGRES_DB} already exists`);
            } else {
                throw err;
            }
        });
        
        // Close the connection to the postgres database
        await pool.end();
        
        // Connect to our new database
        const appPool = new Pool({
            user: process.env.POSTGRES_USER,
            host: process.env.POSTGRES_HOST,
            database: process.env.POSTGRES_DB,
            password: process.env.POSTGRES_PASSWORD,
            port: process.env.POSTGRES_PORT,
        });

        // Create tables
        await appPool.query(`
            CREATE TABLE IF NOT EXISTS quiz_history (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                category TEXT NOT NULL,
                score INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_quiz_history_user ON quiz_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_quiz_history_guild ON quiz_history(guild_id);
            CREATE INDEX IF NOT EXISTS idx_quiz_history_timestamp ON quiz_history(timestamp);
        `);

        console.log('Database tables created successfully');
        
        await appPool.end();
    } catch (error) {
        console.error('Error creating database:', error);
    }
}

createDatabase(); 