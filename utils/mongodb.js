const mongoose = require('mongoose');

let cachedConnection = null;

async function connectToDatabase() {
    if (cachedConnection) {
        return cachedConnection;
    }

    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not defined');
    }

    try {
        console.log('Connecting to MongoDB...');
        
        const opts = {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
            socketTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        };

        const connection = await mongoose.connect(uri, opts);
        console.log('Successfully connected to MongoDB');
        
        cachedConnection = connection;
        return connection;
    } catch (error) {
        console.error('MongoDB connection error details:', {
            error: error.message,
            code: error.code,
            uri: uri ? uri.substring(0, uri.indexOf('://') + 3) + '...' : 'undefined'
        });
        throw error;
    }
}

module.exports = { connectToDatabase };
