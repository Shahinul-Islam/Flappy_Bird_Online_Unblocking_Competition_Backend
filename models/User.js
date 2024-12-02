const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        trim: true,
        validate: {
            validator: function(v) {
                // Validate Bangladeshi mobile number format
                return /^(\+880|0)?1[0-9]{9}$/.test(v);
            },
            message: props => `${props.value} is not a valid Bangladeshi mobile number!`
        }
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [100, 'Email cannot be more than 100 characters']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    referralId: {
        type: String,
        unique: true,
        default: function() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substr(2, 5);
            return `${timestamp}${random}`.toUpperCase();
        }
    },
    referralLink: {
        type: String,
        unique: true,
        default: function() {
            if (!this.referralId) {
                const timestamp = Date.now().toString(36);
                const random = Math.random().toString(36).substr(2, 5);
                this.referralId = `${timestamp}${random}`.toUpperCase();
            }
            const baseUrl = process.env.FRONTEND_URL || 'https://flappy-bird-game.vercel.app';
            return `${baseUrl}/invite?ref=${this.referralId}`;
        }
    },
    referralCount: {
        type: Number,
        default: 0
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    highScore: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Create indexes
userSchema.index({ mobile: 1 }, { unique: true });
userSchema.index({ referralId: 1 }, { unique: true });
userSchema.index({ referralLink: 1 }, { unique: true });
userSchema.index({ referredBy: 1 });

let User;
try {
    User = mongoose.model('User');
} catch (e) {
    User = mongoose.model('User', userSchema);
}

module.exports = User;
