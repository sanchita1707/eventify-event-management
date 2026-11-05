const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    provider: {
      type: String,
      enum: ['razorpay', 'razorpay_test_sandbox'],
      default: 'razorpay'
    },
    razorpayOrderId: {
      type: String,
      required: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      default: ''
    },
    razorpaySignature: {
      type: String,
      default: ''
    },
    paymentMethod: {
      type: String,
      default: 'card'
    },
    status: {
      type: String,
      enum: ['created', 'captured', 'failed', 'refunded'],
      default: 'created',
      index: true
    },
    failureReason: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);

