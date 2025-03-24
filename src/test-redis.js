require('dotenv').config();
const Redis = require('ioredis');

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3
});

async function testRedis() {
    try {
        // Test basic set/get
        await redis.set('test_key', 'Hello from Redis!');
        const value = await redis.get('test_key');
        console.log('Retrieved value:', value);

        // Test expiration
        await redis.setex('expiring_key', 5, 'This will expire in 5 seconds');
        console.log('Expiring key set');

        // Test increment
        await redis.incr('counter');
        const counter = await redis.get('counter');
        console.log('Counter value:', counter);

        console.log('All Redis tests passed successfully!');
    } catch (error) {
        console.error('Redis test failed:', error);
    } finally {
        redis.quit();
    }
}

testRedis(); 