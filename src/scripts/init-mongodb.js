require('dotenv').config();
const { MongoClient } = require('mongodb');

async function initializeMongoDB() {
    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db();

        // Create collections
        await db.createCollection('challenge_history');
        await db.createCollection('challenge_solutions');

        // Create indexes
        await db.collection('challenge_history').createIndexes([
            { key: { user_id: 1, timestamp: -1 } },
            { key: { guild_id: 1, timestamp: -1 } },
            { key: { category: 1 } },
            { key: { timestamp: 1 }, expireAfterSeconds: 5 * 24 * 60 * 60 } // 5 days TTL
        ]);

        await db.collection('challenge_solutions').createIndexes([
            { key: { challenge_id: 1 } },
            { key: { user_id: 1 } },
            { key: { timestamp: 1 }, expireAfterSeconds: 5 * 24 * 60 * 60 } // 5 days TTL
        ]);

        console.log('MongoDB collections and indexes created successfully');
    } catch (error) {
        console.error('Error initializing MongoDB:', error);
    } finally {
        await client.close();
    }
}

initializeMongoDB(); 