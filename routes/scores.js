const express = require("express");
const Score = require("../models/Score");
const { body, validationResult } = require("express-validator");
const dbConnect = require("../config/database");
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

// GET route to fetch leaderboard data
router.get("/", async (req, res) => {
    console.log('GET /api/scores - Starting request');
    
    try {
        console.log('Connecting to database...');
        await dbConnect();
        console.log('Database connection successful');

        console.log('Fetching scores...');
        const allScores = await Score.find().lean().exec();
        console.log(`Retrieved ${allScores.length} scores`);

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

        const response = {};
        for (const [period, scores] of Object.entries(scoresByPeriod)) {
            response[period] = scores
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
        }

        console.log('Successfully processed scores');
        res.json(response);
    } catch (error) {
        console.error('Error in GET /api/scores:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        res.status(500).json({ 
            error: "Error fetching leaderboard data",
            details: error.message
        });
    }
});

// POST route to add or update a score
router.post(
    "/",
    [
        body("username").trim().escape().isLength({ min: 1 }).withMessage("Username is required"),
        body("email").isEmail().withMessage("Invalid email format"),
        body("score").isInt({ gt: 0 }).withMessage("Score must be a positive integer"),
    ],
    async (req, res) => {
        try {
            await dbConnect();
            
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, email, score } = req.body;

            const result = await Score.findOneAndUpdate(
                { email },
                { username, email, score, createdAt: new Date() },
                { new: true, upsert: true }
            ).lean();

            res.status(200).json({ 
                message: "Score updated successfully!", 
                result: {
                    username: result.username,
                    email: result.email,
                    score: result.score
                }
            });
        } catch (error) {
            console.error('Error in POST /api/scores:', error);
            res.status(500).json({ 
                error: "Internal server error",
                details: error.message
            });
        }
    }
);

module.exports = router;
