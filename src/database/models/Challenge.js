const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    tips: [String],
    difficulty: { type: Number, required: true },
    category: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    solutions: [{
        userId: String,
        username: String,
        solution: String,
        modelResponse: String,
        evaluation: String,
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Challenge', challengeSchema); 