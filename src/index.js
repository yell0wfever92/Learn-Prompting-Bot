require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { initializeConnections } = require('./config/database');
const { initializeSchema } = require('./database/schema');
const mongoose = require('mongoose');

// Initialize Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Create a collection for commands
client.commands = new Collection();

// Load commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Bot ready event
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    try {
        // Initialize database connections - make sure this completes before proceeding
        await initializeConnections();
        
        // Initialize database schema
        await initializeSchema();
        
        console.log('Database system initialized successfully');
        
        // Initialize guildChallenges Map
        client.guildChallenges = new Map();
        
        // Clean up old challenges every hour using MongoDB
        setInterval(async () => {
            try {
                const Challenge = mongoose.model('challenge_history');
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                
                // Delete challenges older than 24 hours
                await Challenge.deleteMany({
                    timestamp: { $lt: oneDayAgo }
                });
                
                // Update the cache
                const activeChallenges = await Challenge.find({
                    timestamp: { $gte: oneDayAgo }
                });
                
                client.guildChallenges.clear();
                activeChallenges.forEach(challenge => {
                    client.guildChallenges.set(challenge.guildId, challenge);
                });
            } catch (error) {
                console.error('Error cleaning up old challenges:', error);
            }
        }, 60 * 60 * 1000); // Check every hour
    } catch (error) {
        console.error('Failed to initialize database system:', error);
        process.exit(1);
    }
});

// Message handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ 
            content: 'There was an error executing this command!', 
            ephemeral: true 
        });
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    try {
        await mongoose.connection.close();
        await client.destroy();
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);