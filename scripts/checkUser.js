const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const user = await User.findOne({ mobile: '+8801736553937' });
        if (user) {
            console.log('User found:', {
                name: user.name,
                mobile: user.mobile,
                email: user.email,
                highScore: user.highScore,
                createdAt: user.createdAt
            });
        } else {
            console.log('User not found');
            
            // List all users in the database
            console.log('\nListing all users:');
            const allUsers = await User.find({}, 'name mobile email highScore');
            allUsers.forEach(user => {
                console.log({
                    name: user.name,
                    mobile: user.mobile,
                    email: user.email,
                    highScore: user.highScore
                });
            });
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

checkUser();
