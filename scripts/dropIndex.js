const mongoose = require('mongoose');
require('dotenv').config();

async function dropIndex() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Drop the problematic index
        await mongoose.connection.db.collection('users').dropIndex('referralId_1');
        console.log('Successfully dropped referralId index');

        // List remaining indexes
        const indexes = await mongoose.connection.db.collection('users').listIndexes().toArray();
        console.log('Remaining indexes:', indexes);

    } catch (error) {
        if (error.code === 27) {
            console.log('Index referralId_1 does not exist - this is fine');
        } else {
            console.error('Error:', error);
        }
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

dropIndex();
