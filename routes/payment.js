const express = require("express");
const Payment = require("../models/Payment");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const isAdmin = require("../middleware/adminAuth");
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    try {
        const token = req.header("Authorization");
        if (!token) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
    }
};

// Initiate payment
router.post("/initiate", verifyToken, async (req, res) => {
    try {
        const { bkashNumber } = req.body;
        
        // Validate bKash number
        if (!bkashNumber || !/^(\+880|0)?1[0-9]{9}$/.test(bkashNumber)) {
            return res.status(400).json({ error: "Invalid bKash number format" });
        }

        const userId = req.userId;

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if user already has a valid payment
        if (user.isPaymentValid && user.paymentValidUntil > new Date()) {
            return res.status(400).json({
                error: "You already have a valid payment until " + user.paymentValidUntil
            });
        }

        // Create a new payment record
        const payment = new Payment({
            userId,
            bkashNumber: bkashNumber.startsWith('+880') ? 
                bkashNumber : `+880${bkashNumber.replace(/^0/, '')}`,
            amount: 10
        });

        await payment.save();

        res.status(200).json({
            success: true,
            message: "Payment initiated successfully",
            payment: {
                id: payment._id,
                amount: payment.amount,
                bkashNumber: payment.bkashNumber,
                instructions: [
                    "1. Open your bKash app",
                    "2. Send 10 TK to: 01XXXXXXXXX", // Replace with your bKash merchant number
                    "3. Copy the Transaction ID",
                    "4. Submit the Transaction ID using the verify endpoint"
                ]
            }
        });
    } catch (error) {
        console.error('Payment initiation error:', error);
        res.status(500).json({
            error: "Error initiating payment",
            details: error.message
        });
    }
});

// Verify payment
router.post("/verify", verifyToken, async (req, res) => {
    try {
        const { paymentId, transactionId } = req.body;

        // Validate required fields
        if (!paymentId || !transactionId) {
            return res.status(400).json({
                error: "Missing required fields",
                required: {
                    paymentId: "Payment ID is required",
                    transactionId: "Transaction ID is required"
                }
            });
        }

        const userId = req.userId;

        // Find the payment
        const payment = await Payment.findOne({
            _id: paymentId,
            userId,
            // transactionId

        });

        if (!payment) {
            return res.status(404).json({ error: "Payment not found" });
        }

        if (payment.status === 'COMPLETED') {
            return res.status(400).json({ error: "Payment already completed" });
        }

        // Update payment status
        payment.status = 'COMPLETED';
        payment.transactionId = transactionId;
       


        await payment.save();

        // Get the validUntil date from the payment model
        const validUntil = payment.validUntil;

        // Update user payment status
        await User.findByIdAndUpdate(userId, {
            isPaymentValid: true,
            lastPaymentDate: new Date(),
            paymentValidUntil: validUntil
        });

        res.json({
            success: true,
            message: "Payment verified successfully",
            payment: {
                id: payment._id,
                status: payment.status,
                amount: payment.amount,
                validUntil: validUntil
            }
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            error: "Error verifying payment",
            details: error.message
        });
    }
});

// Check payment status
router.get("/status", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const isValid = user.isPaymentValid && user.paymentValidUntil > new Date();

        res.json({
            isPaymentValid: isValid,
            lastPaymentDate: user.lastPaymentDate,
            validUntil: user.paymentValidUntil,
            needsPayment: !isValid,
            amount: 10 // 10 TK
        });
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({
            error: "Error checking payment status",
            details: error.message
        });
    }
});

// Admin Routes

// Get all payments with pagination and filters
router.get("/admin/payments", verifyToken, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        // Build query
        const query = {};
        if (status) query.status = status;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Get total count
        const total = await Payment.countDocuments(query);

        // Get paginated payments
        const payments = await Payment.find(query)
            .populate('userId', 'mobileNumber name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            success: true,
            payments,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            error: "Error fetching payments",
            details: error.message
        });
    }
});

// Get payment statistics
router.get("/admin/statistics", verifyToken, isAdmin, async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Get counts
        const totalPayments = await Payment.countDocuments();
        const completedPayments = await Payment.countDocuments({ status: 'COMPLETED' });
        const todayPayments = await Payment.countDocuments({
            createdAt: { $gte: startOfDay },
            status: 'COMPLETED'
        });
        const monthlyPayments = await Payment.countDocuments({
            createdAt: { $gte: startOfMonth },
            status: 'COMPLETED'
        });

        // Calculate revenue
        const totalRevenue = await Payment.aggregate([
            { $match: { status: 'COMPLETED' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const monthlyRevenue = await Payment.aggregate([
            {
                $match: {
                    status: 'COMPLETED',
                    createdAt: { $gte: startOfMonth }
                }
            },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        res.json({
            success: true,
            statistics: {
                totalPayments,
                completedPayments,
                todayPayments,
                monthlyPayments,
                totalRevenue: totalRevenue[0]?.total || 0,
                monthlyRevenue: monthlyRevenue[0]?.total || 0,
                completionRate: ((completedPayments / totalPayments) * 100).toFixed(2) + '%'
            }
        });
    } catch (error) {
        res.status(500).json({
            error: "Error fetching payment statistics",
            details: error.message
        });
    }
});

// Get payment details
router.get("/admin/payments/:paymentId", verifyToken, isAdmin, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId)
            .populate('userId', 'mobileNumber name email');

        if (!payment) {
            return res.status(404).json({ error: "Payment not found" });
        }

        res.json({
            success: true,
            payment
        });
    } catch (error) {
        res.status(500).json({
            error: "Error fetching payment details",
            details: error.message
        });
    }
});

// Update payment status manually
router.patch("/admin/payments/:paymentId", verifyToken, isAdmin, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const payment = await Payment.findById(req.params.paymentId);

        if (!payment) {
            return res.status(404).json({ error: "Payment not found" });
        }

        // Update payment
        payment.status = status || payment.status;
        payment.notes = notes || payment.notes;
        await payment.save();

        // If payment is completed, update user payment status
        if (status === 'COMPLETED') {
            const validUntil = new Date();
            validUntil.setMonth(validUntil.getMonth() + 1);

            await User.findByIdAndUpdate(payment.userId, {
                isPaymentValid: true,
                lastPaymentDate: new Date(),
                paymentValidUntil: validUntil
            });
        }

        res.json({
            success: true,
            message: "Payment updated successfully",
            payment
        });
    } catch (error) {
        res.status(500).json({
            error: "Error updating payment",
            details: error.message
        });
    }
});

// Get users with expired payments
router.get("/admin/expired-payments", verifyToken, isAdmin, async (req, res) => {
    try {
        const users = await User.find({
            $or: [
                { paymentValidUntil: { $lt: new Date() } },
                { isPaymentValid: false }
            ]
        }).select('name mobileNumber email paymentValidUntil lastPaymentDate');

        res.json({
            success: true,
            users
        });
    } catch (error) {
        res.status(500).json({
            error: "Error fetching expired payments",
            details: error.message
        });
    }
});

module.exports = router;
