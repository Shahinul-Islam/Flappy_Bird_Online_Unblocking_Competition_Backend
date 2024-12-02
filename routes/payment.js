const express = require("express");
const Payment = require("../models/Payment");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
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
            userId
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

        // Update user payment status
        const validUntil = new Date();
        validUntil.setMonth(validUntil.getMonth() + 1);
        
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

module.exports = router;
