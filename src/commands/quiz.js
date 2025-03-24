const { SlashCommandBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const { quizService } = require('../database/services');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Define the main quiz categories
const quizCategories = {
    'AGENTS': 'AI Agents',
    'REDTEAM': 'AI Red Teaming',
    'FUNDAMENTALS': 'Prompt Engineering Fundamentals',
    'JAILBREAK': 'Jailbreaking LLMs'
};

async function askQuestion(interaction, quiz, questionNumber) {
    const currentQ = quiz.questions[questionNumber];
    const questionEmbed = {
        color: 0x0099ff,
        title: `Quiz on "${quiz.category}" - Question ${questionNumber + 1}/${quiz.questions.length}`,
        description: currentQ.question,
        fields: [
            {
                name: 'Options',
                value: currentQ.options.join('\n')
            }
        ],
        footer: { text: 'Reply with A, B, C, or D' }
    };

    await interaction.followUp({ embeds: [questionEmbed] });

    const filter = m => {
        if (m.author.id !== interaction.user.id) return false;
        const content = m.content.trim().toUpperCase();
        return ['A', 'B', 'C', 'D'].includes(content);
    };

    const collector = interaction.channel.createMessageCollector({ 
        filter, 
        time: 30000,
        max: 1
    });

    return new Promise((resolve) => {
        collector.on('collect', async (message) => {
            const userAnswer = message.content.trim().toUpperCase().charCodeAt(0) - 65;
            const isCorrect = userAnswer === currentQ.correct;
            
            if (isCorrect) quiz.score++;

            await message.reply({
                embeds: [{
                    color: isCorrect ? 0x00ff00 : 0xff0000,
                    description: `${isCorrect ? '✅ Correct!' : '❌ Incorrect!'}\n${currentQ.explanation}`
                }]
            });

            collector.stop();
            resolve(true);
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                interaction.followUp('Time\'s up for this question!');
                resolve(false);
            }
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Start a quiz on prompt engineering topics')
        .addStringOption(option =>
            option
                .setName('category')
                .setDescription('Select the quiz category')
                .setRequired(true)
                .addChoices(
                    { name: 'AI Agents', value: 'AGENTS' },
                    { name: 'AI Red Teaming', value: 'REDTEAM' },
                    { name: 'Prompt Engineering Fundamentals', value: 'FUNDAMENTALS' },
                    { name: 'Jailbreaking LLMs', value: 'JAILBREAK' }
                ))
        .addIntegerOption(option =>
            option
                .setName('questions')
                .setDescription('Number of questions (1-5)')
                .setMinValue(1)
                .setMaxValue(5)
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        
        const category = interaction.options.getString('category');
        const categoryName = quizCategories[category];
        const numQuestions = interaction.options.getInteger('questions') ?? 3;
        console.log(`Starting quiz on category: ${categoryName}`);

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a quiz generator for all things prompt engineering and AI red teaming, including prompt injection, evasion, and other techniques designed to bypass LLM defenses. Generate quiz questions in a specific JSON format. Make questions challenging, never vanilla or obvious. An optional topic may be provided; if no topic is given, keep the questions focused to a discipline in prompt engineering or AI jailbreaking. Get creative when coming up with topics."
                    },
                    {
                        role: "user",
                        content: `Generate ${numQuestions} multiple-choice questions about ${categoryName}. Questions should be specifically focused on ${categoryName} concepts and techniques. Return as JSON with this structure:
                        {
                            "questions": [
                                {
                                    "question": "question text",
                                    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
                                    "correct": 0,
                                    "explanation": "brief explanation of the correct answer"
                                }
                            ]
                        }`
                    }
                ],
                temperature: 0.7,
            });

            let quizData;
            try {
                const content = response.choices[0].message.content;
                const jsonString = content.replace(/```json\n?|```\n?/g, '').trim();
                quizData = JSON.parse(jsonString);
                
                if (!quizData.questions || !Array.isArray(quizData.questions)) {
                    throw new Error('Invalid quiz data structure: missing or invalid questions array');
                }
                
                for (const question of quizData.questions) {
                    if (!question.question || typeof question.question !== 'string') {
                        throw new Error('Invalid question format: missing or invalid question text');
                    }
                    if (!Array.isArray(question.options) || question.options.length !== 4) {
                        throw new Error('Invalid question format: options must be an array of 4 items');
                    }
                    if (typeof question.correct !== 'number' || question.correct < 0 || question.correct > 3) {
                        throw new Error('Invalid question format: correct answer must be 0-3');
                    }
                    if (!question.explanation || typeof question.explanation !== 'string') {
                        throw new Error('Invalid question format: missing or invalid explanation');
                    }
                }
            } catch (error) {
                console.error('JSON parsing error:', error);
                console.error('Raw content:', response.choices[0].message.content);
                throw new Error('Failed to generate valid quiz questions. Please try again.');
            }

            if (!interaction.client.activeQuizzes) {
                interaction.client.activeQuizzes = new Map();
            }
            
            const quiz = {
                questions: quizData.questions,
                currentQuestion: 0,
                score: 0,
                category: categoryName
            };

            for (let i = 0; i < quiz.questions.length; i++) {
                const answered = await askQuestion(interaction, quiz, i);
                if (!answered) {
                    break;
                }
            }

            // Save quiz results to database
            await quizService.saveQuiz(
                interaction.user.id,
                interaction.guild.id,
                categoryName,
                quiz.score,
                numQuestions
            );

            await interaction.followUp({
                embeds: [{
                    color: 0x0099ff,
                    title: 'Quiz Complete! 🎉',
                    description: `Final Score: ${quiz.score}/${numQuestions}\n\nThanks for playing!`
                }]
            });

        } catch (error) {
            console.error('Error in quiz:', error);
            await interaction.editReply('Sorry, there was an error running the quiz. Please try again.');
        }
    }
}; 