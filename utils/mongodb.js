const mongoose = require('mongoose');

let cachedConnection = null;

async function connectToDatabase() {
    if (cachedConnection) {
        return cachedConnection;
    }

    try {
        const opts = {
            serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
            maxPoolSize: 10, // Maintain up to 10 socket connections
        };

        const connection = await mongoose.connect(process.env.MONGODB_URI, opts);
        cachedConnection = connection;
        return connection;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

module.exports = { connectToDatabase };
