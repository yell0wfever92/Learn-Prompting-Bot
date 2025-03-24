const { SlashCommandBuilder } = require('discord.js');
const { OpenAI } = require('openai');
const { getContext, updateContext, clearContext } = require('../database');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Have a general conversation with the bot')
        .addSubcommand(subcommand =>
            subcommand
                .setName('message')
                .setDescription('Send a message to the bot')
                .addStringOption(option =>
                    option.setName('content')
                        .setDescription('Your message to the bot')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear your conversation history')),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            if (interaction.options.getSubcommand() === 'clear') {
                await clearContext(interaction.user.id);
                await interaction.editReply('Conversation history cleared!');
                return;
            }

            const userMessage = interaction.options.getString('content');
            const context = await getContext(interaction.user.id);
            
            const messages = [
                {
                    role: "system",
                    content: "You are a helpful AI assistant focused on teaching prompt engineering. You should be friendly, encouraging, and provide practical examples while maintaining ethical guidelines."
                },
                ...context,
                {
                    role: "user",
                    content: userMessage
                }
            ];

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: messages,
                max_tokens: 500
            });

            const reply = response.choices[0].message.content;
            
            // Store the conversation
            await updateContext(interaction.user.id, [
                ...context,
                { role: "user", content: userMessage },
                { role: "assistant", content: reply }
            ]);

            await interaction.editReply(reply);
        } catch (error) {
            console.error('Error in chat command:', error);
            let errorMessage = 'Sorry, I encountered an error processing your request.';
            
            if (error.response?.status === 429) {
                errorMessage = 'I\'m currently experiencing high demand. Please try again in a moment.';
            } else if (error.code === 'SQLITE_CONSTRAINT') {
                errorMessage = 'There was an error with the database. Please try again.';
            }
            
            await interaction.editReply(errorMessage);
        }
    }
}; 