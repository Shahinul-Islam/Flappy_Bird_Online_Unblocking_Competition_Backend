const express = require("express");
const Score = require("../models/Score");
const GameSession = require("../models/GameSession");
const { body, validationResult } = require("express-validator");
const dbConnect = require("../config/database");
const verifyToken = require("../middleware/auth");
const { 
    generateSessionToken, 
    verifyGameplay, 
    calculateEventsChecksum, 
    verifyClientIntegrity 
} = require("../utils/gameVerification");
const router = express.Router();

// Rate limit for game sessions and score submissions
const rateLimit = require("express-rate-limit");
const gameSessionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 game sessions per minute
    message: "Too many game sessions created, please try again later"
});

const scoreSubmitLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 score submissions per 5 minutes
    message: "Too many score submissions, please try again later"
});

// Initialize game session
router.post("/start-session", [verifyToken, gameSessionLimiter], async (req, res) => {
    try {
        const { clientVersion, deviceInfo } = req.body;

        // Verify client version
        if (!verifyClientIntegrity(clientVersion, process.env.CURRENT_CLIENT_VERSION)) {
            return res.status(400).json({
                error: "Client version mismatch",
                message: "Please update your game client"
            });
        }

        const { sessionId, timestamp } = generateSessionToken(req.userId);
        
        const session = new GameSession({
            userId: req.userId,
            sessionId,
            startTime: new Date(timestamp),
            clientVersion,
            deviceInfo
        });

        await session.save();

        res.json({
            success: true,
            sessionId,
            timestamp
        });
    } catch (error) {
        res.status(500).json({
            error: "Error creating game session",
            details: error.message
        });
    }
});

// Record game event
router.post("/record-event/:sessionId", verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { eventType, eventData, timestamp } = req.body;

        const session = await GameSession.findOne({
            userId: req.userId,
            sessionId,
            endTime: null
        });

        if (!session) {
            return res.status(404).json({
                error: "Active session not found",
                message: "Please start a new game session"
            });
        }

        session.gameEvents.push({
            timestamp: new Date(timestamp),
            type: eventType,
            data: eventData
        });

        await session.save();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            error: "Error recording game event",
            details: error.message
        });
    }
});

// Submit final score with verification
router.post(
    "/submit",
    [
        verifyToken,
        scoreSubmitLimiter,
        body("sessionId").notEmpty().withMessage("Session ID is required"),
        body("score").isInt({ min: 0, max: 999999 }).withMessage("Invalid score"),
        body("gameEvents").isArray().withMessage("Game events are required"),
        body("checksum").notEmpty().withMessage("Checksum is required")
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: errors.array()
                });
            }

            const { sessionId, score, gameEvents, checksum } = req.body;

            // Verify session exists and belongs to user
            const session = await GameSession.findOne({
                userId: req.userId,
                sessionId,
                endTime: null
            });

            if (!session) {
                return res.status(404).json({
                    error: "Session not found",
                    message: "Invalid or expired game session"
                });
            }

            // Verify events checksum
            const calculatedChecksum = calculateEventsChecksum(gameEvents);
            if (checksum !== calculatedChecksum) {
                return res.status(400).json({
                    error: "Invalid checksum",
                    message: "Game data has been tampered with"
                });
            }

            // Verify gameplay
            const verification = verifyGameplay(gameEvents, score);
            if (!verification.valid) {
                return res.status(400).json({
                    error: "Invalid gameplay",
                    message: verification.reason
                });
            }

            // Update session
            session.endTime = new Date();
            session.finalScore = score;
            session.verified = true;
            session.checksum = checksum;
            await session.save();

            // Update user's score if it's their best
            const existingScore = await Score.findOne({ userId: req.userId });
            if (!existingScore || score > existingScore.score) {
                await Score.findOneAndUpdate(
                    { userId: req.userId },
                    { 
                        userId: req.userId,
                        score,
                        sessionId,
                        createdAt: new Date()
                    },
                    { upsert: true }
                );
            }

            res.json({
                success: true,
                message: "Score verified and recorded",
                finalScore: score
            });
        } catch (error) {
            res.status(500).json({
                error: "Error submitting score",
                details: error.message
            });
        }
    }
);

// GET route to fetch leaderboard data (public access with rate limiting)
router.get("/", async (req, res) => {
    console.log('GET /api/scores - Starting request');
    
    try {
        console.log('Connecting to database...');
        await dbConnect();
        console.log('Database connection successful');

        console.log('Fetching scores...');
        const allScores = await Score.find()
            .select('username score createdAt')
            .sort({ score: -1 })
            .lean()
            .exec();
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

// Helper function to calculate period
function calculatePeriod(date) {
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffInDays < 1) return "today";
    if (diffInDays < 7) return "last7Days";
    if (diffInDays < 30) return "last30Days";
    return "older";
}

// Get user's personal best scores
router.get("/personal", verifyToken, async (req, res) => {
    try {
        const userScores = await Score.find({ userId: req.userId })
            .sort({ score: -1 })
            .limit(10)
            .select('score createdAt')
            .lean();

        res.json({
            success: true,
            scores: userScores
        });
    } catch (error) {
        res.status(500).json({
            error: "Error fetching personal scores",
            details: error.message
        });
    }
});

module.exports = router;
