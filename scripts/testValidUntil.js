const mongoose = require('mongoose');
require('dotenv').config();

async function testValidUntil() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const Payment = require('../models/Payment');

        // Create a test payment without saving
        const testPayment = new Payment({
            userId: new mongoose.Types.ObjectId(), // Dummy user ID
            amount: 10,
            bkashNumber: '+8801723736786'
        });

        // Current date and time
        const now = new Date();
        console.log('\nDetailed Date Information:');
        console.log('Current Date:', now.toLocaleString('en-US', { 
            timeZone: 'Asia/Dhaka',
            dateStyle: 'full',
            timeStyle: 'long'
        }));
        
        // Get validUntil date
        const validUntil = testPayment.validUntil;
        console.log('Valid Until:', validUntil.toLocaleString('en-US', { 
            timeZone: 'Asia/Dhaka',
            dateStyle: 'full',
            timeStyle: 'long'
        }));
        
        // Calculate exact difference
        const diffTime = validUntil.getTime() - now.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        console.log('\nTime Difference Analysis:');
        console.log('Difference in days (exact):', diffDays.toFixed(2));
        console.log('Difference in hours:', (diffTime / (1000 * 60 * 60)).toFixed(2));
        
        // Show day by day breakdown
        console.log('\nDay by Day Coverage:');
        const dates = [];
        let currentDate = new Date(now);
        while (currentDate <= validUntil) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        dates.forEach(date => {
            console.log(date.toLocaleDateString('en-US', { 
                timeZone: 'Asia/Dhaka',
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            }));
        });

    } catch (error) {
        console.error('Error testing validUntil:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testValidUntil();
