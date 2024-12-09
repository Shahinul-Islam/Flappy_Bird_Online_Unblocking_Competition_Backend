const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection;
        const collection = db.collection('users');

        // Drop all referral-related indexes
        const indexes = await collection.listIndexes().toArray();
        for (const index of indexes) {
            if (index.name.includes('referral') || index.key.referralCode || index.key.referralId) {
                try {
                    await collection.dropIndex(index.name);
                    console.log(`Dropped index: ${index.name}`);
                } catch (error) {
                    console.log(`Error dropping index ${index.name}:`, error.message);
                }
            }
        }

        // Create new referralId index
        await collection.createIndex(
            { referralId: 1 },
            { 
                name: 'idx_referralId_unique_sparse',
                unique: true,
                sparse: true,
                background: true
            }
        );
        console.log('Successfully created new referralId index');

        // Update any documents that might have referralCode to use referralId
        const result = await collection.updateMany(
            { referralCode: { $exists: true } },
            [
                {
                    $set: {
                        referralId: '$referralCode',
                        referralCode: '$$REMOVE'
                    }
                }
            ]
        );
        console.log(`Updated ${result.modifiedCount} documents`);

        console.log('Index fix completed successfully');
    } catch (error) {
        console.error('Error fixing indexes:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixIndexes();
