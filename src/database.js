const sqlite3 = require('sqlite3').verbose();

// Initialize SQLite database
const db = new sqlite3.Database('conversations.db');

// Create conversations table if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
        user_id TEXT PRIMARY KEY,
        context TEXT
    )
`);

// Helper functions for context management
function getContext(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT context FROM conversations WHERE user_id = ?', [userId], (err, row) => {
            if (err) reject(err);
            if (row) {
                resolve(JSON.parse(row.context));
            } else {
                resolve([]);
            }
        });
    });
}

function updateContext(userId, context) {
    // Keep only last 10 messages to allow for more meaningful conversations
    const limitedContext = context.slice(-10);
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO conversations (user_id, context) VALUES (?, ?)',
            [userId, JSON.stringify(limitedContext)],
            (err) => {
                if (err) reject(err);
                resolve();
            }
        );
    });
}

function clearContext(userId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM conversations WHERE user_id = ?', [userId], (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

module.exports = {
    getContext,
    updateContext,
    clearContext
}; 