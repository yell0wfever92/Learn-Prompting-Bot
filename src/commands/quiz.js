const { SlashCommandBuilder } = require('discord.js');

const quizQuestions = [
    {
        question: "What is the primary purpose of prompt engineering?",
        options: [
            "To make AI models work faster",
            "To improve the quality and reliability of AI outputs",
            "To make AI models use less resources",
            "To make AI models smaller"
        ],
        correct: 1
    },
    {
        question: "Which of these is NOT a best practice in prompt engineering?",
        options: [
            "Being specific and clear",
            "Using consistent formatting",
            "Making prompts as long as possible",
            "Testing and iterating"
        ],
        correct: 2
    },
    {
        question: "What is 'prompt injection'?",
        options: [
            "A way to make AI models faster",
            "A technique to improve prompt clarity",
            "A security vulnerability where malicious prompts can override system instructions",
            "A method to compress prompts"
        ],
        correct: 2
    }
];

let currentQuiz = null;
let currentQuestionIndex = 0;
let quizTimeout = null;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Start a prompt engineering quiz')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start a new quiz'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the current quiz')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'start') {
            if (currentQuiz) {
                await interaction.reply('A quiz is already in progress! Use `/quiz stop` to end it first.');
                return;
            }

            currentQuiz = {
                channel: interaction.channel,
                score: 0,
                participants: new Set()
            };

            await startQuestion(interaction);
        } else if (subcommand === 'stop') {
            if (!currentQuiz) {
                await interaction.reply('No quiz is currently in progress!');
                return;
            }

            if (quizTimeout) {
                clearTimeout(quizTimeout);
            }

            await interaction.reply(`Quiz ended! Final score: ${currentQuiz.score}/${currentQuestionIndex}`);
            currentQuiz = null;
            currentQuestionIndex = 0;
        }
    }
};

async function startQuestion(interaction) {
    if (currentQuestionIndex >= quizQuestions.length) {
        await interaction.channel.send(`Quiz completed! Final score: ${currentQuiz.score}/${quizQuestions.length}`);
        currentQuiz = null;
        currentQuestionIndex = 0;
        return;
    }

    const question = quizQuestions[currentQuestionIndex];
    const options = question.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

    const message = await interaction.channel.send({
        embeds: [{
            title: `Question ${currentQuestionIndex + 1}/${quizQuestions.length}`,
            description: `${question.question}\n\n${options}`,
            color: 0x0099FF
        }]
    });

    // Add reactions for each option
    for (let i = 0; i < question.options.length; i++) {
        await message.react(`${i + 1}️⃣`);
    }

    // Set up reaction collector
    const filter = (reaction, user) => {
        return ['1️⃣', '2️⃣', '3️⃣', '4️⃣'].includes(reaction.emoji.name) && !user.bot;
    };

    const collector = message.createReactionCollector({ filter, time: 30000 });

    collector.on('collect', async (reaction, user) => {
        if (currentQuiz.participants.has(user.id)) {
            return;
        }

        currentQuiz.participants.add(user.id);
        const selectedOption = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'].indexOf(reaction.emoji.name);

        if (selectedOption === question.correct) {
            currentQuiz.score++;
            await interaction.channel.send(`${user} got it correct! 🎉`);
        } else {
            await interaction.channel.send(`${user} got it wrong. The correct answer was: ${question.options[question.correct]}`);
        }

        collector.stop();
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            await interaction.channel.send('Time\'s up! Moving to the next question...');
        }

        currentQuestionIndex++;
        await startQuestion(interaction);
    });
} 