const mongoose = require('mongoose');
require('dotenv').config();

async function syncPaymentDates() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Payment = require('../models/Payment');
        const User = require('../models/User');

        // Get all completed payments
        const payments = await Payment.find({ 
            status: 'COMPLETED' 
        }).sort({ validUntil: -1 });

        console.log(`Found ${payments.length} completed payments`);

        // Group payments by user
        const userPayments = {};
        payments.forEach(payment => {
            const userId = payment.userId.toString();
            if (!userPayments[userId] || payment.validUntil > userPayments[userId]) {
                userPayments[userId] = payment.validUntil;
            }
        });

        // Update users with their latest validUntil dates
        const updatePromises = Object.entries(userPayments).map(([userId, validUntil]) => 
            User.findByIdAndUpdate(userId, { validUntil })
        );

        await Promise.all(updatePromises);
        console.log(`Updated ${updatePromises.length} users with their latest payment dates`);

        console.log('Sync completed successfully');
    } catch (error) {
        console.error('Error syncing payment dates:', error);
    } finally {
        await mongoose.disconnect();
    }
}

syncPaymentDates();
