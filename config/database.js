const mongoose = require('mongoose');
const dotenv = require("dotenv");
const path = require('path');

// Load environment variables from the root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Available environment variables:', Object.keys(process.env));
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

// Global promise configuration
mongoose.Promise = global.Promise;

let isConnected = false;
let cachedDb = null;

async function dbConnect() {
    if (isConnected && cachedDb) {
        console.log('=> Using existing database connection');
        return cachedDb;
    }

    try {
        console.log('=> Using new database connection');
        
        const opts = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4 // Use IPv4, skip trying IPv6
        };

        // Handle deprecation warnings
        mongoose.set('strictQuery', true);
        
        const db = await mongoose.connect(MONGODB_URI, opts);
        
        isConnected = true;
        cachedDb = db;
        
        // Add connection event listeners
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connected successfully');
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
            isConnected = false;
        });

        return db;
    } catch (error) {
        console.error('MongoDB connection error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    if (isConnected) {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
    }
});

module.exports = dbConnect;
