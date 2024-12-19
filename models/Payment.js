const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        default: 10 // 10 TK default
    },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED'],
        default: 'PENDING'
    },
    paymentMethod: {
        type: String,
        enum: ['BKASH'],
        default: 'BKASH'
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    bkashNumber: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                // Validate Bangladeshi mobile number format for bKash
                return /^(\+880|0)?1[0-9]{9}$/.test(v);
            },
            message: props => `${props.value} is not a valid bKash number!`
        }
    },
    validUntil: {
        type: Date,
        required: true,
        default: function() {
            const now = new Date();
            // Add exactly 7 days (in milliseconds)
            const validUntil = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
            // Set to end of the day
            validUntil.setHours(23, 59, 59, 999);
            console.log('Valid Until:', validUntil);
            return validUntil;
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create indexes
paymentSchema.index({ userId: 1 });
paymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ validUntil: 1 });

// Middleware to update user's validUntil when payment is completed
paymentSchema.pre('save', async function(next) {
    try {
        // Only update user's validUntil when payment status changes to COMPLETED
        if (this.isModified('status') && this.status === 'COMPLETED') {
            const User = mongoose.model('User');
            
            // Find current user's validUntil
            const user = await User.findById(this.userId);
            
            // Set new validUntil to the later date between current validUntil and payment validUntil
            const newValidUntil = user.validUntil && user.validUntil > this.validUntil ? 
                user.validUntil : this.validUntil;
            
            // Update user's validUntil
            await User.findByIdAndUpdate(this.userId, {
                validUntil: newValidUntil
            });
        }
        next();
    } catch (error) {
        next(error);
    }
});

let Payment;
try {
    Payment = mongoose.model('Payment');
} catch (e) {
    Payment = mongoose.model('Payment', paymentSchema);
}

module.exports = Payment;
