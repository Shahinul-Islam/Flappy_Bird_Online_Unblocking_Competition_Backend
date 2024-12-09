const express = require("express");
const Score = require("../models/Score");
const verifyToken = require("../middleware/auth");
const rateLimit = require("express-rate-limit");
const router = express.Router();

// Rate limit for score submissions
const scoreSubmitLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 score submissions per 5 minutes
    message: "Too many score submissions, please try again later"
});

// Submit score (requires authentication)
router.post("/submit", verifyToken, scoreSubmitLimiter, async (req, res) => {
    try {
        const { score } = req.body;

        // Basic validation
        if (typeof score !== 'number' || score < 0 || score > 999999) {
            return res.status(400).json({
                error: "Invalid score",
                message: "Score must be a number between 0 and 999999"
            });
        }

        // Create new score entry with user ID
        const newScore = new Score({
            userId: req.userId,
            score
        });

        await newScore.save();

        // Get user's best score
        const bestScore = await Score.findOne({ userId: req.userId })
            .sort({ score: -1 })
            .select('score');

        res.json({
            success: true,
            message: "Score recorded successfully",
            finalScore: score,
            isHighScore: !bestScore || score >= bestScore.score,
            bestScore: bestScore ? bestScore.score : score
        });
    } catch (error) {
        console.error('Error submitting score:', error);
        res.status(500).json({
            error: "Failed to submit score",
            message: error.message
        });
    }
});

// Get top scores (public endpoint)
router.get("/top", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const scores = await Score.find()
            .populate('userId', 'name') // Only include user's name
            .sort({ score: -1 })
            .limit(limit);

        res.json({
            success: true,
            scores: scores.map(score => ({
                score: score.score,
                playerName: score.userId?.name || 'Anonymous',
                date: score.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching top scores:', error);
        res.status(500).json({
            error: "Failed to fetch top scores",
            message: error.message
        });
    }
});

// Get top scores for last 7 days (public endpoint)
router.get("/top/weekly", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const scores = await Score.find({
            createdAt: { $gte: sevenDaysAgo }
        })
            .populate('userId', 'name')
            .sort({ score: -1 })
            .limit(limit);

        res.json({
            success: true,
            scores: scores.map(score => ({
                score: score.score,
                playerName: score.userId?.name || 'Anonymous',
                date: score.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching weekly top scores:', error);
        res.status(500).json({
            error: "Failed to fetch weekly top scores",
            message: error.message
        });
    }
});

// Get top scores for last month (public endpoint)
router.get("/top/monthly", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const scores = await Score.find({
            createdAt: { $gte: thirtyDaysAgo }
        })
            .populate('userId', 'name')
            .sort({ score: -1 })
            .limit(limit);

        res.json({
            success: true,
            scores: scores.map(score => ({
                score: score.score,
                playerName: score.userId?.name || 'Anonymous',
                date: score.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching monthly top scores:', error);
        res.status(500).json({
            error: "Failed to fetch monthly top scores",
            message: error.message
        });
    }
});

// Get user's scores (requires authentication)
router.get("/my-scores", verifyToken, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const scores = await Score.find({ userId: req.userId })
            .sort({ score: -1 })
            .limit(limit);

        res.json({
            success: true,
            scores
        });
    } catch (error) {
        console.error('Error fetching user scores:', error);
        res.status(500).json({
            error: "Failed to fetch user scores",
            message: error.message
        });
    }
});

module.exports = router;
