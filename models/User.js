const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [100, 'Email cannot be more than 100 characters'],
        index: { 
            sparse: true,
            name: 'idx_email_sparse'
        }
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^(\+880|0)?1[3-9][0-9]{8}$/.test(v);
            },
            message: props => `${props.value} is not a valid Bangladeshi mobile number!`
        },
        index: {
            unique: true,
            name: 'idx_mobile_unique'
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    referralCode: {
        type: String,
        unique: true,
        required: true,
        default: function() {
            return crypto.randomBytes(3).toString('hex').toUpperCase();
        },
        index: {
            unique: true,
            sparse: true,
            name: 'idx_referralCode_unique_sparse'
        }
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referralCount: {
        type: Number,
        default: 0
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'banned'],
        default: 'active'
    },
    highScore: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    const user = this;
    
    // Only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) return next();
    
    try {
        // Generate salt and hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Generate referral code before saving if not present
userSchema.pre('save', function(next) {
    if (!this.referralCode) {
        let attempts = 0;
        const maxAttempts = 5;
        
        const generateUniqueCode = () => {
            return crypto.randomBytes(3).toString('hex').toUpperCase();
        };

        const tryGenerateCode = async () => {
            try {
                const code = generateUniqueCode();
                const existingUser = await mongoose.model('User').findOne({ referralCode: code });
                
                if (!existingUser) {
                    this.referralCode = code;
                    return next();
                }
                
                attempts++;
                if (attempts < maxAttempts) {
                    await tryGenerateCode();
                } else {
                    next(new Error('Could not generate unique referral code'));
                }
            } catch (error) {
                next(error);
            }
        };

        tryGenerateCode();
    } else {
        next();
    }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for referral link
userSchema.virtual('referralLink').get(function() {
    if (!this.referralCode) return null;
    return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?ref=${this.referralCode}`;
});

// Configure toJSON
userSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
