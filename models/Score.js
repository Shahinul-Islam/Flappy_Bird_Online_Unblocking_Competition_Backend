const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 999999
    }
}, {
    timestamps: true
});

// Add index for getting top scores by user
scoreSchema.index({ userId: 1, score: -1 });

module.exports = mongoose.model("Score", scoreSchema);
