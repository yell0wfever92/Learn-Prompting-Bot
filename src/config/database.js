const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const { promisify } = require('util');

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

// Redis configuration with fallback
let redis = null;
let redisEnabled = false;

try {
    redis = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        lazyConnect: true // Don't connect immediately
    });

    redis.on('error', (error) => {
        console.warn('Redis connection error:', error);
        redisEnabled = false;
    });

    redis.on('connect', () => {
        console.log('Redis connected successfully');
        redisEnabled = true;
    });
} catch (error) {
    console.warn('Redis initialization error:', error);
    redisEnabled = false;
}

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
        await mongoClient.connect();
        console.log('MongoDB connected successfully');

        // Try to connect to Redis if available
        if (redis) {
            try {
                await redis.connect();
            } catch (error) {
                console.warn('Redis connection failed, continuing without Redis:', error);
            }
        }

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

// Rate limiting middleware with Redis fallback
async function checkRateLimit(userId, guildId, type) {
    if (!redisEnabled) {
        console.warn('Rate limiting disabled - Redis not available');
        return true;
    }

    const limits = RATE_LIMITS[type];
    if (!limits) return true;

    try {
        const userKey = `rate_limit:${type}:user:${userId}`;
        const guildKey = `rate_limit:${type}:guild:${guildId}`;

        const multi = redis.multi();
        multi.incr(userKey);
        multi.expire(userKey, limits.perUser.period);
        multi.incr(guildKey);
        multi.expire(guildKey, limits.perGuild.period);

        const [userCount, , guildCount] = await multi.exec();
        
        return userCount[1] <= limits.perUser.count && 
               guildCount[1] <= limits.perGuild.count;
    } catch (error) {
        console.warn('Rate limiting error, allowing request:', error);
        return true;
    }
}

module.exports = {
    pgPool,
    mongoClient,
    redis,
    redisEnabled,
    initializeConnections,
    checkRateLimit,
    DATA_RETENTION_PERIOD
}; 