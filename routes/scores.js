const express = require("express");
const Score = require("../models/Score");
const { body, validationResult } = require("express-validator");
const router = express.Router();

// Helper function to calculate period
function calculatePeriod(date) {
	const now = new Date();
	const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
	if (diffInDays < 1) return "today";
	if (diffInDays < 7) return "last7Days";
	if (diffInDays < 30) return "last30Days";
	return "older";
}

// POST route to add or update a score with validation
router.post(
	"/",
	[
		body("username")
			.trim()
			.escape()
			.isLength({ min: 1 })
			.withMessage("Username is required"),
		body("email")
			.isEmail()

			.withMessage("Invalid email format"),
		body("score")
			.isInt({ gt: 0 })
			.withMessage("Score must be a positive integer"),
	],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { username, email, score } = req.body;

		try {
			const result = await Score.findOneAndUpdate(
				{ email },
				{ username, email, score, createdAt: new Date() },
				{ new: true, upsert: true, setDefaultsOnInsert: true }
			);

			if (result) {
				res
					.status(200)
					.json({ message: "Score updated successfully!", result });
			} else {
				res.status(201).json({ message: "Score added successfully!", result });
			}
		} catch (error) {
			console.error("Error in POST /api/scores:", error);
			res
				.status(500)
				.json({ error: "Internal server error. Please try again later." });
		}
	}
);

// GET route to fetch leaderboard data
router.get("/", async (req, res) => {
	try {
		const allScores = await Score.find();
		const scoresByPeriod = { today: [], last7Days: [], last30Days: [] };

		allScores.forEach((scoreEntry) => {
			const period = calculatePeriod(scoreEntry.createdAt);
			if (period in scoresByPeriod) {
				scoresByPeriod[period].push({
					username: scoreEntry.username,
					email: scoreEntry.email,
					score: scoreEntry.score,
				});
			}
		});

		const response = {
			today: scoresByPeriod.today
				.sort((a, b) => b.score - a.score)
				.slice(0, 10),
			last7Days: scoresByPeriod.last7Days
				.sort((a, b) => b.score - a.score)
				.slice(0, 10),
			last30Days: scoresByPeriod.last30Days
				.sort((a, b) => b.score - a.score)
				.slice(0, 10),
		};

		res.json(response);
	} catch (error) {
		console.error("Error in GET /api/scores:", error);
		res.status(500).json({ error: "Error fetching leaderboard data" });
	}
});

module.exports = router;
