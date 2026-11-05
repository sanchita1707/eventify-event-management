const mongoose = require('mongoose');

const organizerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    organizationName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    website: {
      type: String,
      default: ''
    },
    contactEmail: {
      type: String,
      required: true
    },
    contactPhone: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'verified'
    },
    totalEventsHosted: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 4.8
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organizer', organizerSchema);

