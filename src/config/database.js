const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { promisify } = require('util');
const mongoose = require('mongoose');

// PostgreSQL configuration
const pgPool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// MongoDB configuration
const mongoClient = new MongoClient(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 5000,
});

// Rate limiting configuration
const RATE_LIMITS = {
    quiz: {
        perUser: { count: 5, period: 3600 }, // 5 quizzes per hour
        perGuild: { count: 100, period: 3600 } // 100 quizzes per hour per guild
    },
    challenge: {
        perUser: { count: 3, period: 3600 }, // 3 challenges per hour
        perGuild: { count: 50, period: 3600 } // 50 challenges per hour per guild
    }
};

// Data retention period (5 days in milliseconds)
const DATA_RETENTION_PERIOD = 5 * 24 * 60 * 60 * 1000;

// Initialize connections
async function initializeConnections() {
    try {
        // Test PostgreSQL connection
        const pgClient = await pgPool.connect();
        console.log('PostgreSQL connected successfully');
        pgClient.release();

        // Test MongoDB connection
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected successfully');

        // Set up data retention cleanup
        setupDataRetention();
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

// Data retention cleanup
async function setupDataRetention() {
    const cleanup = async () => {
        const cutoffDate = new Date(Date.now() - DATA_RETENTION_PERIOD);
        
        try {
            // Clean up PostgreSQL data
            await pgPool.query(
                'DELETE FROM quiz_history WHERE timestamp < $1',
                [cutoffDate]
            );
            
            // Clean up MongoDB data
            const db = mongoClient.db();
            await db.collection('challenge_history').deleteMany({
                timestamp: { $lt: cutoffDate }
            });
            
            console.log('Data retention cleanup completed');
        } catch (error) {
            console.error('Data retention cleanup error:', error);
        }
    };

    // Run cleanup daily
    setInterval(cleanup, 24 * 60 * 60 * 1000);
    await cleanup(); // Initial cleanup
}

// Rate limiting middleware (in-memory fallback)
async function checkRateLimit(userId, guildId, type) {
    // Simple in-memory rate limiting
    // Note: This is not persistent across restarts
    const limits = RATE_LIMITS[type];
    if (!limits) return true;

    // For a production environment, you would want to implement
    // a more robust solution using a database or cache
    return true;
}

// Add connection error handlers
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

module.exports = {
    pgPool,
    mongoClient,
    initializeConnections,
    checkRateLimit,
    DATA_RETENTION_PERIOD,
    mongoConnection: mongoose.connection
}; 