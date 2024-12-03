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
router.post("/register", async (req, res) => {
    try {
        await dbConnect();

        const { name, mobile, password, email, referralCode } = req.body;

        // Validate mobile number format (more flexible)
        const cleanMobile = mobile.replace(/[- ]/g, ''); // Remove spaces and dashes
        if (!cleanMobile.match(/^(?:\+?880|0)?1[3-9][0-9]{8}$/)) {
            return res.status(400).json({
                error: "Invalid mobile number format",
                message: "Please enter a valid Bangladeshi number (e.g., 01712345678 or +8801712345678)"
            });
        }

        // Format mobile number to standard format
        const formattedMobile = cleanMobile.startsWith('+880') ? 
            cleanMobile : 
            cleanMobile.startsWith('880') ? 
                `+${cleanMobile}` : 
                `+880${cleanMobile.replace(/^0/, '')}`;

        // Check if user already exists
        const existingUser = await User.findOne({ mobile: formattedMobile });
        if (existingUser) {
            return res.status(400).json({
                error: "User with this mobile number already exists"
            });
        }

        // Check referral code if provided
        let referredBy = null;
        if (referralCode) {
            referredBy = await User.findOne({ referralId: referralCode });
            if (!referredBy) {
                return res.status(400).json({
                    error: "Invalid referral code"
                });
            }
        }

        // Create new user
        const user = new User({
            name,
            mobile: formattedMobile,
            password,
            email: email || undefined,
            referredBy: referredBy ? referredBy._id : undefined
        });

        await user.save();

        // Update referrer's count if applicable
        if (referredBy) {
            await User.findByIdAndUpdate(referredBy._id, {
                $inc: { referralCount: 1 }
            });
        }

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

// Verify token middleware
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
};

// Get user profile
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId)
            .select('-password')
            .populate('referredBy', 'name mobileNumber');

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Get referral statistics
        const referredUsers = await User.find({ referredBy: user._id })
            .select('name mobileNumber createdAt')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            user: {
                ...user.toObject(),
                referralLink: `${process.env.FRONTEND_URL || 'https://flappy-bird-game.vercel.app'}/invite?ref=${user.referralCode}`,
                referredUsers: referredUsers
            }
        });
    } catch (error) {
        console.error("Profile error:", error);
        res.status(500).json({
            error: "Error fetching profile",
            details: error.message
        });
    }
});

// Get referral stats
router.get("/referrals", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const referredUsers = await User.find({ referredBy: user._id })
            .select('name mobileNumber createdAt')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            referralInfo: {
                referralCode: user.referralCode,
                referralLink: `${process.env.FRONTEND_URL || 'https://flappy-bird-game.vercel.app'}/invite?ref=${user.referralCode}`,
                referralCount: referredUsers.length,
                referredUsers: referredUsers
            }
        });
    } catch (error) {
        console.error("Referral info error:", error);
        res.status(500).json({
            error: "Error fetching referral information",
            details: error.message
        });
    }
});

// Get shareable referral link
router.get("/share-link", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Generate the full referral link
        const baseUrl = process.env.FRONTEND_URL || 'https://flappy-bird-game.vercel.app';
        const referralLink = `${baseUrl}/invite?ref=${user.referralCode}`;

        // Create sharing message
        const shareMessage = `Play Flappy Bird with me and win exciting rewards! Join using my referral link: ${referralLink}`;
        
        // Generate sharing URLs
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`;

        res.json({
            success: true,
            referralLink,
            shareOptions: {
                whatsapp: whatsappUrl,
                facebook: facebookUrl,
                copyText: shareMessage
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
