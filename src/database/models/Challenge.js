const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    tips: [String],
    category: { type: String, required: true },
    behavior: { type: Object, required: true },
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