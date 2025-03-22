require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

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
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Message handling
client.on('messageCreate', async (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the message starts with the command prefix
    if (!message.content.startsWith(process.env.COMMAND_PREFIX)) return;

    // Split the message into command and arguments
    const args = message.content.slice(process.env.COMMAND_PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Handle commands
    if (client.commands.has(commandName)) {
        try {
            await client.commands.get(commandName).execute(message, args);
        } catch (error) {
            console.error(error);
            await message.reply('There was an error executing that command.');
        }
    } else {
        // If it's not a command, try to use OpenAI for general conversation
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful AI assistant focused on teaching prompt engineering. You should be friendly, encouraging, and provide practical examples while maintaining ethical guidelines."
                    },
                    {
                        role: "user",
                        content: message.content
                    }
                ],
                max_tokens: 500
            });

            const reply = response.choices[0].message.content;
            await message.reply(reply);
        } catch (error) {
            console.error('OpenAI API Error:', error);
            await message.reply('Sorry, I encountered an error processing your request.');
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN); 