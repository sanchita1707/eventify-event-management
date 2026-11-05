const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    certificateNumber: {
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
      required: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true
    },
    participantName: {
      type: String,
      required: true
    },
    eventTitle: {
      type: String,
      required: true
    },
    eventDate: {
      type: Date,
      required: true
    },
    organizerName: {
      type: String,
      default: 'EVENTIFY Official Organizer'
    },
    issuedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

certificateSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);

