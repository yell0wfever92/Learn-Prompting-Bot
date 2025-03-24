const { pgPool, mongoClient } = require('../config/database');

// PostgreSQL schema
const pgSchema = `
-- Drop existing table if it exists
DROP TABLE IF EXISTS quiz_history CASCADE;

-- Create quiz_history table with partitioning
CREATE TABLE quiz_history (
    id BIGSERIAL,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    category TEXT NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (timestamp, id)
) PARTITION BY RANGE (timestamp);

-- Create initial partition
CREATE TABLE quiz_history_current PARTITION OF quiz_history
    FOR VALUES FROM (NOW() - INTERVAL '5 days') TO (NOW() + INTERVAL '5 days');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quiz_history_user ON quiz_history(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_guild ON quiz_history(guild_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_category ON quiz_history(category);
CREATE INDEX IF NOT EXISTS idx_quiz_history_timestamp ON quiz_history(timestamp);

-- Create materialized view for leaderboards
CREATE MATERIALIZED VIEW IF NOT EXISTS user_rankings AS
SELECT 
    user_id,
    guild_id,
    COUNT(*) as quizzes_taken,
    AVG(CAST(score AS FLOAT) / total_questions) as avg_score
FROM quiz_history
WHERE timestamp > NOW() - INTERVAL '5 days'
GROUP BY user_id, guild_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_rankings_user_guild 
ON user_rankings(user_id, guild_id);
`;

// MongoDB schema
const mongoSchema = {
    challenge_history: {
        indexes: [
            { key: { user_id: 1, timestamp: -1 } },
            { key: { guild_id: 1, timestamp: -1 } },
            { key: { category: 1 } },
            { key: { timestamp: 1 }, expireAfterSeconds: 5 * 24 * 60 * 60 } // 5 days TTL
        ]
    },
    challenge_solutions: {
        indexes: [
            { key: { challenge_id: 1 } },
            { key: { user_id: 1 } },
            { key: { timestamp: 1 }, expireAfterSeconds: 5 * 24 * 60 * 60 } // 5 days TTL
        ]
    }
};

// Initialize database schema
async function initializeSchema() {
    try {
        // Initialize PostgreSQL schema
        await pgPool.query(pgSchema);
        console.log('PostgreSQL schema initialized');

        // Initialize MongoDB schema
        const db = mongoClient.db();
        for (const [collection, schema] of Object.entries(mongoSchema)) {
            const coll = db.collection(collection);
            for (const index of schema.indexes) {
                await coll.createIndex(index.key, index);
            }
        }
        console.log('MongoDB schema initialized');
    } catch (error) {
        console.error('Schema initialization error:', error);
        throw error;
    }
}

module.exports = {
    initializeSchema
}; 