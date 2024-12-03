const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('users');

        // Step 1: List current indexes
        console.log('\nCurrent indexes:');
        const currentIndexes = await collection.listIndexes().toArray();
        console.log(currentIndexes);

        // Step 2: Drop all non-_id indexes
        const indexesToDrop = currentIndexes
            .filter(index => index.name !== '_id_')
            .map(index => index.name);

        if (indexesToDrop.length > 0) {
            console.log('\nDropping indexes:', indexesToDrop);
            for (const indexName of indexesToDrop) {
                try {
                    await collection.dropIndex(indexName);
                    console.log(`Dropped index: ${indexName}`);
                } catch (error) {
                    console.error(`Error dropping index ${indexName}:`, error.message);
                }
            }
        }

        // Step 3: Create new indexes
        console.log('\nCreating new indexes...');
        
        // Mobile index (unique)
        try {
            await collection.createIndex(
                { mobile: 1 },
                { 
                    name: 'idx_mobile_unique',
                    unique: true,
                    background: true
                }
            );
            console.log('Created mobile index');
        } catch (error) {
            console.error('Error creating mobile index:', error.message);
        }

        // Email index (sparse)
        try {
            await collection.createIndex(
                { email: 1 },
                { 
                    name: 'idx_email_sparse',
                    sparse: true,
                    background: true
                }
            );
            console.log('Created email index');
        } catch (error) {
            console.error('Error creating email index:', error.message);
        }

        // Referral code index (unique, sparse)
        try {
            await collection.createIndex(
                { referralCode: 1 },
                { 
                    name: 'idx_referralCode_unique_sparse',
                    unique: true,
                    sparse: true,
                    background: true
                }
            );
            console.log('Created referral code index');
        } catch (error) {
            console.error('Error creating referral code index:', error.message);
        }

        // Step 4: Verify final indexes
        console.log('\nFinal indexes:');
        const finalIndexes = await collection.listIndexes().toArray();
        console.log(finalIndexes);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

fixIndexes();
