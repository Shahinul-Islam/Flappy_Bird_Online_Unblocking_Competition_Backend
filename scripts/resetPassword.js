const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const mobile = '+8801736553937';
        const newPassword = '123456';

        // Find user
        const user = await User.findOne({ mobile });
        if (!user) {
            console.log('User not found');
            return;
        }

        // Set the new password - this will trigger the pre-save hook
        user.password = newPassword;
        await user.save();  // This will automatically hash the password

        console.log('Password reset successful for user:', user.name);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

resetPassword();
