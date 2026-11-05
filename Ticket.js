const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true
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
    seats: {
      type: [String],
      required: true
    },
    qrCodeDataUrl: {
      type: String,
      required: true
    },
    qrPayloadHash: {
      type: String,
      required: true
    },
    checkInStatus: {
      type: String,
      enum: ['unused', 'checked_in', 'cancelled', 'expired'],
      default: 'unused',
      index: true
    },
    checkedInAt: {
      type: Date,
      default: null
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ticket', ticketSchema);

