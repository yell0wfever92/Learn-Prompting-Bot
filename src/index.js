require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const { initializeConnections } = require('./config/database');
const { initializeSchema } = require('./database/schema');

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
        // Initialize database connections
        await initializeConnections();
        
        // Initialize database schema
        await initializeSchema();
        
        console.log('Database system initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database system:', error);
        process.exit(1);
    }
    
    // Initialize guildChallenges Map
    client.guildChallenges = new Map();
    
    // Clean up old challenges every hour
    setInterval(() => {
        const now = Date.now();
        for (const [guildId, challenge] of client.guildChallenges.entries()) {
            if (now - challenge.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
                client.guildChallenges.delete(guildId);
            }
        }
    }, 60 * 60 * 1000); // Check every hour
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
    await client.destroy();
    process.exit(0);
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);