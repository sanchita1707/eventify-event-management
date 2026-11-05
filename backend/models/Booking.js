const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
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
      required: true,
      index: true
    },
    selectedSeats: [
      {
        seatNumber: { type: String, required: true },
        row: { type: String },
        tier: { type: String, default: 'Standard' },
        price: { type: Number, required: true }
      }
    ],
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    subTotal: {
      type: Number,
      required: true
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    attendeeName: {
      type: String,
      required: true
    },
    attendeeEmail: {
      type: String,
      required: true
    },
    attendeePhone: {
      type: String,
      default: ''
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
      index: true
    },
    bookingStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
      index: true
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);

