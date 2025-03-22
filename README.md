# LearnPrompting Discord Bot

A Discord bot designed to help users learn and practice prompt engineering through interactive quizzes, challenges, and AI-powered conversations.

## Features

- Interactive prompt engineering quizzes
- Weekly prompt engineering challenges
- AI-powered conversation about prompt engineering
- Thread-based discussion for challenge solutions
- Educational content about prompt engineering best practices

## Prerequisites

- Node.js 16.9.0 or higher
- A Discord Bot Token
- An OpenAI API Key

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following content:
   ```
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   OPENAI_API_KEY=your_openai_api_key_here
   COMMAND_PREFIX=!
   ```
4. Replace the placeholder values in the `.env` file with your actual tokens

## Running the Bot

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Commands

- `/quiz start` - Start a new prompt engineering quiz
- `/quiz stop` - Stop the current quiz
- `/challenge get` - Get a new prompt engineering challenge
- `/challenge submit` - Submit your solution to the current challenge

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 