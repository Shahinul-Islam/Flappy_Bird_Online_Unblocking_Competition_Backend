const mongoose = require("mongoose");

const gameSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: Date,
    gameEvents: [{
        timestamp: Date,
        type: String,
        data: mongoose.Schema.Types.Mixed
    }],
    finalScore: {
        type: Number,
        default: 0
    },
    clientVersion: String,
    deviceInfo: {
        platform: String,
        browser: String,
        screenResolution: String
    },
    verified: {
        type: Boolean,
        default: false
    },
    checksum: String // For verifying game events integrity
}, {
    timestamps: true
});

// Index for quick lookups
gameSessionSchema.index({ userId: 1, sessionId: 1 });
gameSessionSchema.index({ startTime: -1 });

const GameSession = mongoose.model('GameSession', gameSessionSchema);

module.exports = GameSession;
