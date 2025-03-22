const { SlashCommandBuilder } = require('discord.js');

const challenges = [
    {
        title: "The Clear Prompt Challenge",
        description: "Create a prompt that gets the AI to write a short story about a robot learning to paint, but make it as clear and specific as possible. Include details about the style, length, and key elements that should be in the story.",
        tips: [
            "Specify the tone of the story",
            "Include desired length",
            "Mention specific elements you want to see",
            "Use clear formatting"
        ]
    },
    {
        title: "The Context Challenge",
        description: "Write a prompt that helps the AI understand a complex technical concept by providing relevant context and examples. Choose any technical topic you're interested in.",
        tips: [
            "Start with background information",
            "Include relevant examples",
            "Break down complex terms",
            "Ask for specific aspects to be explained"
        ]
    },
    {
        title: "The Role-Playing Challenge",
        description: "Create a prompt that makes the AI act as a specific character or expert while maintaining consistent behavior and knowledge. Choose an interesting role and scenario.",
        tips: [
            "Define the character's background",
            "Specify their expertise",
            "Include personality traits",
            "Set up a specific scenario"
        ]
    }
];

let currentChallenge = null;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('Get a prompt engineering challenge')
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('Get a new challenge'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('submit')
                .setDescription('Submit your solution to the current challenge')
                .addStringOption(option =>
                    option
                        .setName('solution')
                        .setDescription('Your prompt solution')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'get') {
            const challenge = challenges[Math.floor(Math.random() * challenges.length)];
            currentChallenge = challenge;

            const tipsList = challenge.tips.map(tip => `• ${tip}`).join('\n');

            await interaction.reply({
                embeds: [{
                    title: challenge.title,
                    description: `${challenge.description}\n\n**Tips:**\n${tipsList}`,
                    color: 0x00FF00,
                    footer: {
                        text: 'Use /challenge submit to share your solution!'
                    }
                }]
            });
        } else if (subcommand === 'submit') {
            if (!currentChallenge) {
                await interaction.reply('There is no active challenge! Use `/challenge get` to get a new challenge.');
                return;
            }

            const solution = interaction.options.getString('solution');
            
            // Create a thread for discussion
            const thread = await interaction.channel.threads.create({
                name: `${interaction.user.username}'s Solution - ${currentChallenge.title}`,
                autoArchiveDuration: 1440,
                reason: 'Challenge solution submission'
            });

            await thread.send({
                embeds: [{
                    title: `${interaction.user.username}'s Solution`,
                    description: solution,
                    color: 0x0099FF
                }]
            });

            await interaction.reply({
                content: `Your solution has been posted in ${thread}!`,
                ephemeral: true
            });
        }
    }
}; 