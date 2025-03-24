require('dotenv').config();
const { Pool } = require('pg');

async function checkQuizData() {
    const pool = new Pool({
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: process.env.POSTGRES_PORT,
    });

    try {
        // Get recent quiz attempts
        const recentQuizzes = await pool.query(`
            SELECT * FROM quiz_history 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        
        console.log('\nRecent Quiz Attempts:');
        console.log('-------------------');
        recentQuizzes.rows.forEach(quiz => {
            console.log(`User: ${quiz.user_id}`);
            console.log(`Category: ${quiz.category}`);
            console.log(`Score: ${quiz.score}/${quiz.total_questions}`);
            console.log(`Timestamp: ${quiz.timestamp}`);
            console.log('-------------------');
        });

        // Get leaderboard
        const leaderboard = await pool.query(`
            SELECT 
                user_id,
                COUNT(*) as attempts,
                AVG(CAST(score AS FLOAT) / total_questions) as avg_score
            FROM quiz_history
            GROUP BY user_id
            ORDER BY avg_score DESC
            LIMIT 5
        `);

        console.log('\nTop 5 Users:');
        console.log('-------------------');
        leaderboard.rows.forEach((user, index) => {
            console.log(`#${index + 1} User: ${user.user_id}`);
            console.log(`Attempts: ${user.attempts}`);
            console.log(`Average Score: ${Math.round(user.avg_score * 100)}%`);
            console.log('-------------------');
        });

    } catch (error) {
        console.error('Error checking quiz data:', error);
    } finally {
        await pool.end();
    }
}

checkQuizData(); 