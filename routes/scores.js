const express = require("express");
const Score = require("../models/Score");
const { body, validationResult } = require("express-validator");
const { connectToDatabase } = require("../utils/mongodb");
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
        try {
            await connectToDatabase();
            
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, email, score } = req.body;

            const result = await Score.findOneAndUpdate(
                { email },
                { username, email, score, createdAt: new Date() },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );

            if (result) {
                res.status(200).json({ 
                    message: "Score updated successfully!", 
                    result: {
                        username: result.username,
                        email: result.email,
                        score: result.score
                    }
                });
            }
        } catch (error) {
            console.error("Error in POST /api/scores:", error);
            res.status(500).json({ 
                error: "Internal server error. Please try again later.",
                details: error.message 
            });
        }
    }
);

// GET route to fetch leaderboard data
router.get("/", async (req, res) => {
    try {
        await connectToDatabase();
        
        const allScores = await Score.find({}, null, { 
            timeout: 5000,  // 5 second timeout
            lean: true      // Return plain objects instead of Mongoose documents
        });

        const scoresByPeriod = {
            today: [],
            last7Days: [],
            last30Days: []
        };

        allScores.forEach((scoreEntry) => {
            const period = calculatePeriod(scoreEntry.createdAt);
            if (period in scoresByPeriod) {
                scoresByPeriod[period].push({
                    username: scoreEntry.username,
                    score: scoreEntry.score
                });
            }
        });

        // Process each period's scores in parallel
        const response = Object.fromEntries(
            await Promise.all(
                Object.entries(scoresByPeriod).map(async ([period, scores]) => [
                    period,
                    scores.sort((a, b) => b.score - a.score).slice(0, 10)
                ])
            )
        );

        res.json(response);
    } catch (error) {
        console.error("Error in GET /api/scores:", error);
        res.status(500).json({ 
            error: "Error fetching leaderboard data",
            details: error.message 
        });
    }
});

module.exports = router;
