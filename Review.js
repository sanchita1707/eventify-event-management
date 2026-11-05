const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating between 1 and 5'],
      min: 1,
      max: 5
    },
    title: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },
    comment: {
      type: String,
      required: [true, 'Please provide a review comment'],
      trim: true,
      maxlength: 1000
    },
    isVerifiedAttendee: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['approved', 'flagged', 'hidden'],
      default: 'approved'
    }
  },
  { timestamps: true }
);

reviewSchema.index({ event: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

