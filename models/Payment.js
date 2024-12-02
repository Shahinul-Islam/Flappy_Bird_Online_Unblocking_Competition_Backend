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
            // Valid until the end of next month
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth() + 2, 0);
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

let Payment;
try {
    Payment = mongoose.model('Payment');
} catch (e) {
    Payment = mongoose.model('Payment', paymentSchema);
}

module.exports = Payment;
