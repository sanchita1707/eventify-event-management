const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Message is required']
    },
    category: {
      type: String,
      enum: ['general', 'booking_issue', 'payment_issue', 'organizer_support', 'complaint'],
      default: 'general'
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open'
    },
    adminResponse: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);

