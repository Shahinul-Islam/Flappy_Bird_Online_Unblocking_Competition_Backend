const mongoose = require('mongoose');
require('dotenv').config();

async function checkAndFixCollections() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        
        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\nExisting collections:');
        collections.forEach(col => {
            console.log(`- ${col.name} (type: ${col.type})`);
        });

        // Check for user-related collections
        const userCollections = collections.filter(col => 
            col.name.toLowerCase().includes('user') ||
            col.name.toLowerCase().includes('users')
        );

        if (userCollections.length > 1) {
            console.log('\nFound multiple user collections:');
            for (const col of userCollections) {
                const count = await db.collection(col.name).countDocuments();
                console.log(`${col.name}: ${count} documents`);
                
                // Show sample documents from each collection
                const samples = await db.collection(col.name).find().limit(2).toArray();
                console.log(`Sample documents from ${col.name}:`);
                console.log(JSON.stringify(samples, null, 2));
            }

            // Ask for confirmation before proceeding
            console.log('\nTo fix this, run this script with the --fix flag to:');
            console.log('1. Migrate data from flappy_bird_users to users collection');
            console.log('2. Remove the old flappy_bird_users collection');
            
            if (process.argv.includes('--fix')) {
                console.log('\nFixing collections...');
                
                const oldDocs = await db.collection('flappy_bird_users').find().toArray();
                console.log(`Found ${oldDocs.length} documents in flappy_bird_users`);

                let migratedCount = 0;
                let skippedCount = 0;

                for (const oldDoc of oldDocs) {
                    try {
                        // Convert old schema to new schema
                        const newDoc = {
                            name: oldDoc.username || 'Unknown',
                            email: oldDoc.email,
                            highScore: oldDoc.score || 0,
                            referralCount: 0,
                            isPaymentValid: false,
                            createdAt: oldDoc.createdAt || new Date(),
                            updatedAt: oldDoc.updatedAt || new Date()
                        };

                        // Check if user already exists
                        const existingUser = await db.collection('users').findOne({ email: oldDoc.email });
                        
                        if (!existingUser && oldDoc.email) {
                            await db.collection('users').insertOne(newDoc);
                            migratedCount++;
                            console.log(`Migrated user: ${oldDoc.email}`);
                        } else {
                            skippedCount++;
                            if (existingUser) {
                                // Update high score if the old score is higher
                                if (oldDoc.score > existingUser.highScore) {
                                    await db.collection('users').updateOne(
                                        { email: oldDoc.email },
                                        { $set: { highScore: oldDoc.score } }
                                    );
                                    console.log(`Updated high score for: ${oldDoc.email}`);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error migrating document: ${error.message}`);
                    }
                }

                console.log(`\nMigration summary:`);
                console.log(`- Migrated: ${migratedCount} users`);
                console.log(`- Skipped: ${skippedCount} users (already exist or invalid)`);

                // Drop the old collection
                await db.collection('flappy_bird_users').drop();
                console.log('Dropped flappy_bird_users collection');

                // Verify the fix
                console.log('\nVerifying fix...');
                const finalCollections = await db.listCollections().toArray();
                const finalUserCollections = finalCollections.filter(col => 
                    col.name.toLowerCase().includes('user') ||
                    col.name.toLowerCase().includes('users')
                );
                console.log(`Final user collections count: ${finalUserCollections.length}`);
                
                const finalCount = await db.collection('users').countDocuments();
                console.log(`Final document count in users: ${finalCount}`);
            }
        } else {
            console.log('\nNo duplicate user collections found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

checkAndFixCollections();
