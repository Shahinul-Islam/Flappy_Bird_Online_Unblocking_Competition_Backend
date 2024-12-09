const express = require("express");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
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

        const { name, mobile, password, email, referralId } = req.body;

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
        if (referralId) {
            referredBy = await User.findOne({ referralId: referralId });
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

        // If there's a referrer, increment their referral count
        if (referredBy) {
            await User.findByIdAndUpdate(referredBy._id, { $inc: { referralCount: 1 } });
        }

        // Generate token
        const token = generateToken(user._id);

        // Get the saved user with virtuals populated
        const savedUser = await User.findById(user._id);

        res.status(201).json({
            message: "Registration successful",
            token,
            user: {
                id: savedUser._id,
                name: savedUser.name,
                mobile: savedUser.mobile,
                email: savedUser.email,
                referralId: savedUser.referralId,
                referralLink: savedUser.referralLink,
                referralCount: savedUser.referralCount,
                highScore: savedUser.highScore
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
router.post("/login", async (req, res) => {
    try {
        await dbConnect();

        const { mobile, password } = req.body;

        // Validate required fields
        if (!mobile || !password) {
            return res.status(400).json({
                error: "Validation failed",
                message: "Mobile number and password are required"
            });
        }

        // Format mobile number
        const cleanMobile = mobile.replace(/[- ]/g, '');
        const formattedMobile = cleanMobile.startsWith('+880') ? 
            cleanMobile : 
            cleanMobile.startsWith('880') ? 
                `+${cleanMobile}` : 
                `+880${cleanMobile.replace(/^0/, '')}`;

        // Validate mobile number format
        if (!formattedMobile.match(/^\+8801[3-9][0-9]{8}$/)) {
            return res.status(400).json({
                error: "Invalid mobile number format",
                message: "Please enter a valid Bangladeshi number"
            });
        }

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
            details: error.message
        });
    }
});

// Get user profile
router.get("/profile", async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                error: "No token provided"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.json({
            success: true,
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
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: "Invalid token"
            });
        }
        res.status(500).json({
            error: "Error fetching profile",
            details: error.message
        });
    }
});

// Generate share link for referral with social sharing options
router.get("/share-link", async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                error: "No token provided"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Generate referral link if not exists
        if (!user.referralLink) {
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            user.referralLink = `${baseUrl}/register?ref=${user.referralId}`;
            await user.save();
        }

        // Create sharing message
        const shareMessage = encodeURIComponent(`Join me on Flappy Bird! Use my referral code: ${user.referralId}`);
        const shareUrl = encodeURIComponent(user.referralLink);

        // Generate social sharing links
        const whatsappUrl = `https://api.whatsapp.com/send?text=${shareMessage}%20${shareUrl}`;
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareMessage}`;
        

        res.json({
            success: true,
            referralId: user.referralId,
            referralLink: user.referralLink,
            referralCount: user.referralCount,
            shareLinks: {
                whatsapp: whatsappUrl,
                facebook: facebookUrl
               
            }
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: "Invalid token"
            });
        }
        res.status(500).json({
            error: "Error generating share link",
            details: error.message
        });
    }
});

// Get user's referrals
router.get("/referrals", async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                error: "No token provided"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        // Find all users who were referred by this user
        const referrals = await User.find({ referredBy: user._id })
            .select('name mobile createdAt')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            referralCount: user.referralCount,
            referralId: user.referralId,
            referrals: referrals.map(ref => ({
                name: ref.name,
                mobile: ref.mobile,
                joinedAt: ref.createdAt
            }))
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: "Invalid token"
            });
        }
        res.status(500).json({
            error: "Error fetching referrals",
            details: error.message
        });
    }
});

module.exports = router;
