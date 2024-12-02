const express = require("express");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const dbConnect = require("../config/database");
const router = express.Router();

// Helper function to generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// Middleware to handle JSON parsing errors
router.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('JSON Parse Error:', err.message);
        return res.status(400).json({ 
            error: "Invalid JSON format", 
            message: "Please ensure your request body is valid JSON",
            details: err.message 
        });
    }
    next(err);
});

// Register new user
router.post("/register", [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("mobile")
        .trim()
        .matches(/^(\+880|0)?1[0-9]{9}$/)
        .withMessage("Invalid Bangladeshi mobile number"),
    body("password")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters"),
    body("email")
        .optional()
        .isEmail()
        .withMessage("Invalid email format")
], async (req, res) => {
    try {
        await dbConnect();

        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, mobile, email, password, referralId } = req.body;

        // Check if mobile number already exists
        const existingUser = await User.findOne({ mobile });
        if (existingUser) {
            return res.status(400).json({
                error: "Mobile number already registered"
            });
        }

        // Create new user
        const user = new User({
            name,
            mobile: mobile.startsWith('+880') ? mobile : `+880${mobile.replace(/^0/, '')}`,
            email,
            password
        });

        // Handle referral
        if (referralId) {
            const referrer = await User.findOne({ referralId });
            if (referrer) {
                user.referredBy = referrer._id;
                await User.findByIdAndUpdate(referrer._id, {
                    $inc: { referralCount: 1 }
                });
            }
        }

        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            message: "Registration successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                mobile: user.mobile,
                email: user.email,
                referralId: user.referralId,
                referralLink: user.referralLink,
                referralCount: user.referralCount,
                highScore: user.highScore
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: "Error during registration",
            details: error.message
        });
    }
});

// Login user
router.post("/login", [
    body("mobile")
        .trim()
        .matches(/^(\+880|0)?1[0-9]{9}$/)
        .withMessage("Invalid Bangladeshi mobile number"),
    body("password")
        .notEmpty()
        .withMessage("Password is required")
], async (req, res) => {
    try {
        await dbConnect();

        // Log the received request body
        console.log('Login request body:', req.body);

        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: "Validation failed", 
                details: errors.array() 
            });
        }

        const { mobile, password } = req.body;
        
        // Format mobile number
        const formattedMobile = mobile.startsWith('+880') ? 
            mobile : `+880${mobile.replace(/^0/, '')}`;

        console.log('Searching for user with mobile:', formattedMobile);

        // Find user
        const user = await User.findOne({ mobile: formattedMobile });
        if (!user) {
            return res.status(401).json({
                error: "Authentication failed",
                message: "Invalid mobile number or password"
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                error: "Authentication failed",
                message: "Invalid mobile number or password"
            });
        }

        // Generate token
        const token = generateToken(user._id);

        // Log successful login
        console.log('User logged in successfully:', user.mobile);

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                mobile: user.mobile,
                email: user.email,
                referralId: user.referralId,
                referralLink: user.referralLink,
                referralCount: user.referralCount,
                highScore: user.highScore
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: "Error during login",
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get user profile
router.get("/profile", async (req, res) => {
    try {
        await dbConnect();

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId)
            .select('-password');

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            user: {
                id: user._id,
                name: user.name,
                mobile: user.mobile,
                email: user.email,
                referralId: user.referralId,
                referralLink: user.referralLink,
                referralCount: user.referralCount,
                highScore: user.highScore
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            error: "Error fetching profile",
            details: error.message
        });
    }
});

// Get referral stats
router.get("/referrals", async (req, res) => {
    try {
        await dbConnect();

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Get users referred by this user
        const referredUsers = await User.find({ referredBy: user._id })
            .select('name mobile createdAt highScore')
            .sort('-createdAt');

        res.json({
            referralStats: {
                totalReferrals: user.referralCount,
                referralId: user.referralId,
                referralLink: user.referralLink,
                isEligibleForRewards: user.referralCount >= 10,
                referredUsers
            }
        });
    } catch (error) {
        console.error('Referral stats error:', error);
        res.status(500).json({
            error: "Error fetching referral stats",
            details: error.message
        });
    }
});

// Get shareable referral link
router.get("/share-link", async (req, res) => {
    try {
        await dbConnect();

        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Create share text with WhatsApp and Facebook sharing URLs
        const shareText = encodeURIComponent(`Play Flappy Bird with me and win exciting rewards! Join using my referral link: ${user.referralLink}`);
        
        res.json({
            referralLink: user.referralLink,
            shareOptions: {
                whatsapp: `https://wa.me/?text=${shareText}`,
                facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(user.referralLink)}`,
                copyText: `Play Flappy Bird with me and win exciting rewards! Join using my referral link: ${user.referralLink}`
            }
        });
    } catch (error) {
        console.error('Share link error:', error);
        res.status(500).json({
            error: "Error generating share link",
            details: error.message
        });
    }
});

module.exports = router;
