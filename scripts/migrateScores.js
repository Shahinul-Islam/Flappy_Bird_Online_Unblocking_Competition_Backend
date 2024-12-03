const mongoose = require('mongoose');
require('dotenv').config();

async function migrateScores() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        
        // Check if old collection exists
        const collections = await db.listCollections().toArray();
        const oldCollection = collections.find(col => col.name === 'flappy_bird_users');
        
        if (!oldCollection) {
            console.log('No old scores collection found. Nothing to migrate.');
            return;
        }

        // Get all documents from old collection
        const oldScores = await db.collection('flappy_bird_users').find({}).toArray();
        console.log(`Found ${oldScores.length} old scores to migrate`);

        if (oldScores.length === 0) {
            console.log('No scores to migrate');
            return;
        }

        // Create new scores collection if it doesn't exist
        if (!collections.find(col => col.name === 'scores')) {
            await db.createCollection('scores');
            console.log('Created new scores collection');
        }

        // Get users by email for mapping
        const users = await db.collection('users').find({}).toArray();
        const emailToUserId = new Map(users.map(u => [u.email, u._id]));

        // Migrate scores
        let migratedCount = 0;
        let skippedCount = 0;

        for (const oldScore of oldScores) {
            try {
                const userId = emailToUserId.get(oldScore.email);
                
                if (!userId) {
                    console.log(`Skipping score for ${oldScore.email} - user not found`);
                    skippedCount++;
                    continue;
                }

                const newScore = {
                    userId: userId,
                    score: oldScore.score,
                    isVerified: true, // Mark old scores as verified
                    sessionId: 'MIGRATED_' + oldScore._id.toString(),
                    clientVersion: 'MIGRATED',
                    createdAt: oldScore.createdAt || new Date(),
                    updatedAt: oldScore.updatedAt || new Date()
                };

                await db.collection('scores').insertOne(newScore);
                migratedCount++;
                
                if (migratedCount % 10 === 0) {
                    console.log(`Migrated ${migratedCount} scores...`);
                }
            } catch (error) {
                console.error(`Error migrating score: ${error.message}`);
                skippedCount++;
            }
        }

        console.log('\nMigration complete!');
        console.log(`Successfully migrated: ${migratedCount} scores`);
        console.log(`Skipped: ${skippedCount} scores`);

        // Drop old collection if migration was successful
        if (migratedCount > 0) {
            await db.collection('flappy_bird_users').drop();
            console.log('Dropped old scores collection');
        }

    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

migrateScores();
