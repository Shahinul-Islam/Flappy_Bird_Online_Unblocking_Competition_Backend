const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: [true, 'Username is required'],
        trim: true,
        maxlength: [50, 'Username cannot be more than 50 characters']
    },
    email: { 
        type: String, 
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        maxlength: [100, 'Email cannot be more than 100 characters']
    },
    score: { 
        type: Number, 
        required: [true, 'Score is required'],
        min: [0, 'Score cannot be negative']
    },
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true // Add index for date queries
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps
    collection: 'flappy_bird_users', // Explicitly set collection name
    strict: true // Enforce schema validation
});

// Add compound index for email and score
scoreSchema.index({ email: 1, score: -1 });

// Add error handling to the model
scoreSchema.post('save', function(error, doc, next) {
    if (error.name === 'MongoServerError' && error.code === 11000) {
        next(new Error('A score with this email already exists'));
    } else {
        next(error);
    }
});

// Handle undefined fields
scoreSchema.pre('save', function(next) {
    const score = this;
    
    // Set default values if undefined
    if (score.createdAt === undefined) {
        score.createdAt = new Date();
    }
    
    next();
});

// Create the model
let Score;
try {
    // Try to get the existing model
    Score = mongoose.model('Score');
} catch (e) {
    // Model doesn't exist, create it
    Score = mongoose.model('Score', scoreSchema);
}

module.exports = Score;
