const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    score: { 
        type: Number, 
        required: [true, 'Score is required'],
        min: [0, 'Score cannot be negative']
    },
    sessionId: {
        type: String,
        required: [true, 'Session ID is required'],
        index: true
    },
    isVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    gameEvents: [{
        timestamp: Date,
        type: String,
        data: mongoose.Schema.Types.Mixed
    }],
    deviceInfo: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    clientVersion: {
        type: String,
        required: [true, 'Client version is required']
    }
}, {
    timestamps: true,
    collection: 'scores'
});

// Add compound indexes for common queries
scoreSchema.index({ userId: 1, score: -1 });
scoreSchema.index({ createdAt: -1 });
scoreSchema.index({ score: -1, isVerified: 1 });

const Score = mongoose.model('Score', scoreSchema);

module.exports = Score;
