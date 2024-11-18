const mongoose = require('mongoose');
const dotenv = require("dotenv");
const path = require('path');

// Load environment variables from the root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Available environment variables:', Object.keys(process.env));
    throw new Error(
        'Please define the MONGODB_URI environment variable inside .env'
    );
}

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
    if (cached.conn) {
        console.log('Using cached connection');
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            maxPoolSize: 10,
        };

        console.log('Creating new connection to MongoDB...');
        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            console.log('Connected to MongoDB');
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
        return cached.conn;
    } catch (e) {
        cached.promise = null;
        throw e;
    }
}

module.exports = dbConnect;
