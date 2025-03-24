const { pgPool, mongoClient, redis, redisEnabled } = require('../config/database');

// Cache TTL in seconds
const CACHE_TTL = 3600; // 1 hour

// Cache helper functions
const cache = {
    async get(key) {
        if (!redisEnabled) return null;
        try {
            return await redis.get(key);
        } catch (error) {
            console.warn('Cache get error:', error);
            return null;
        }
    },
    async set(key, value, ttl = CACHE_TTL) {
        if (!redisEnabled) return;
        try {
            await redis.setex(key, ttl, value);
        } catch (error) {
            console.warn('Cache set error:', error);
        }
    },
    async del(key) {
        if (!redisEnabled) return;
        try {
            await redis.del(key);
        } catch (error) {
            console.warn('Cache delete error:', error);
        }
    }
};

// Quiz Services
const quizService = {
    async saveQuiz(userId, guildId, category, score, totalQuestions) {
        const query = `
            INSERT INTO quiz_history (user_id, guild_id, category, score, total_questions)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;
        
        const result = await pgPool.query(query, [
            userId, guildId, category, score, totalQuestions
        ]);

        // Invalidate relevant caches
        await cache.del(`quiz:leaderboard:${guildId}`);
        await cache.del(`quiz:user:${userId}:stats`);

        return result.rows[0].id;
    },

    async getLeaderboard(guildId, page = 1, limit = 10) {
        const cacheKey = `quiz:leaderboard:${guildId}:${page}:${limit}`;
        
        // Try to get from cache
        const cached = await cache.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const offset = (page - 1) * limit;
        const query = `
            SELECT 
                user_id,
                COUNT(*) as quizzes_taken,
                AVG(CAST(score AS FLOAT) / total_questions) as avg_score
            FROM quiz_history
            WHERE guild_id = $1
            AND timestamp > NOW() - INTERVAL '5 days'
            GROUP BY user_id
            ORDER BY avg_score DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pgPool.query(query, [guildId, limit, offset]);

        // Cache the result
        await cache.set(cacheKey, JSON.stringify(result.rows));

        return result.rows;
    },

    async getUserStats(userId) {
        const cacheKey = `quiz:user:${userId}:stats`;
        
        // Try to get from cache
        const cached = await cache.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const query = `
            SELECT 
                category,
                COUNT(*) as attempts,
                AVG(CAST(score AS FLOAT) / total_questions) as avg_score
            FROM quiz_history
            WHERE user_id = $1
            AND timestamp > NOW() - INTERVAL '5 days'
            GROUP BY category
        `;

        const result = await pgPool.query(query, [userId]);

        // Cache the result
        await cache.set(cacheKey, JSON.stringify(result.rows));

        return result.rows;
    }
};

// Challenge Services
const challengeService = {
    async saveChallenge(challenge) {
        const db = mongoClient.db();
        const result = await db.collection('challenge_history').insertOne({
            ...challenge,
            timestamp: new Date()
        });

        // Invalidate relevant caches
        await cache.del(`challenge:active:${challenge.guild_id}`);
        await cache.del(`challenge:user:${challenge.user_id}:recent`);

        return result.insertedId;
    },

    async saveSolution(solution) {
        const db = mongoClient.db();
        const result = await db.collection('challenge_solutions').insertOne({
            ...solution,
            timestamp: new Date()
        });

        // Invalidate relevant caches
        await cache.del(`challenge:solutions:${solution.challenge_id}`);

        return result.insertedId;
    },

    async getActiveChallenge(guildId) {
        const cacheKey = `challenge:active:${guildId}`;
        
        // Try to get from cache
        const cached = await cache.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const db = mongoClient.db();
        const challenge = await db.collection('challenge_history')
            .findOne({
                guild_id: guildId,
                timestamp: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });

        if (challenge) {
            // Cache the result
            await cache.set(cacheKey, JSON.stringify(challenge));
        }

        return challenge;
    },

    async getChallengeSolutions(challengeId, page = 1, limit = 10) {
        const cacheKey = `challenge:solutions:${challengeId}:${page}:${limit}`;
        
        // Try to get from cache
        const cached = await cache.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const db = mongoClient.db();
        const solutions = await db.collection('challenge_solutions')
            .find({ challenge_id: challengeId })
            .sort({ timestamp: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();

        // Cache the result
        await cache.set(cacheKey, JSON.stringify(solutions));

        return solutions;
    }
};

module.exports = {
    quizService,
    challengeService
}; 