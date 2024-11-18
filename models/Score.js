const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
	username: { type: String, required: true },
	email: { type: String, required: true },
	score: { type: Number, required: true },
	createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Score", scoreSchema, "flappy_bird_users"); // Specify 'flappy_bird_users' as collection
