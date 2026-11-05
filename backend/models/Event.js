const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    seatNumber: { type: String, required: true },
    row: { type: String, required: true },
    tier: { type: String, enum: ['VIP', 'Premium', 'Standard'], default: 'Standard' },
    price: { type: Number, required: true },
    status: { type: String, enum: ['available', 'booked'], default: 'available' },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lockExpiresAt: { type: Date, default: null }
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [140, 'Title cannot exceed 140 characters']
    },
    slug: {
      type: String,
      unique: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Event description is required']
    },
    shortDescription: {
      type: String,
      maxlength: [260, 'Short description cannot exceed 260 characters']
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Event category is required'],
      index: true
    },
    categoryName: {
      type: String,
      required: true
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    organizerName: {
      type: String,
      default: 'Eventify Organizer'
    },
    poster: {
      type: String,
      default: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80'
    },
    date: {
      type: Date,
      required: [true, 'Event start date is required'],
      index: true
    },
    endDate: {
      type: Date
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      default: '18:00'
    },
    endTime: {
      type: String,
      default: '21:00'
    },
    venue: {
      type: String,
      required: [true, 'Venue name is required']
    },
    address: {
      type: String,
      required: [true, 'Venue address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      index: true
    },
    ticketType: {
      type: String,
      default: 'Multi-Tier Seated (VIP, Premium & Standard)'
    },
    ticketPrice: {
      type: Number,
      required: [true, 'Base ticket price is required'],
      min: [0, 'Price cannot be negative']
    },
    vipPrice: {
      type: Number,
      default: 0
    },
    premiumPrice: {
      type: Number,
      default: 0
    },
    capacity: {
      type: Number,
      required: [true, 'Total capacity is required'],
      min: [1, 'Capacity must be at least 1']
    },
    availableSeats: {
      type: Number,
      required: true
    },
    maxTicketsPerCustomer: {
      type: Number,
      default: 10,
      min: [1, 'Minimum 1 ticket per customer'],
      max: [50, 'Maximum 50 tickets per customer']
    },
    termsAndConditions: {
      type: String,
      default:
        '1. Entry requires a valid EVENTIFY Smart QR Ticket and government photo ID.\n2. Please arrive at least 30 minutes before the scheduled start time.\n3. Duplicate QR scans are strictly blocked by the anti-fraud entry system.'
    },
    eventSchedule: [
      {
        time: { type: String },
        title: { type: String },
        description: { type: String }
      }
    ],
    hasSeatingChart: {
      type: Boolean,
      default: true
    },
    seatLayout: {
      rows: { type: Number, default: 6 },
      cols: { type: Number, default: 10 },
      seats: [seatSchema]
    },
    tags: {
      type: [String],
      default: []
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    isTrending: {
      type: Boolean,
      default: false
    },
    certificateEligible: {
      type: Boolean,
      default: true
    },
    isDraft: {
      type: Boolean,
      default: false
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled', 'draft'],
      default: 'upcoming',
      index: true
    },
    viewsCount: {
      type: Number,
      default: 0
    },
    bookingsCount: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 4.5
    },
    reviewsCount: {
      type: Number,
      default: 0
    },
    speakersOrArtists: [
      {
        name: String,
        role: String,
        avatar: String
      }
    ]
  },
  { timestamps: true }
);

// Helper to initialize seats automatically when creating an event
eventSchema.statics.generateSeats = function (rows = 6, cols = 10, basePrice = 500, vipPrice = 1200, premiumPrice = 800) {
  const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const seats = [];
  const actualVip = vipPrice > 0 ? vipPrice : Math.round(basePrice * 2);
  const actualPremium = premiumPrice > 0 ? premiumPrice : Math.round(basePrice * 1.5);

  for (let r = 0; r < rows; r++) {
    const rowLetter = rowLabels[r] || `R${r + 1}`;
    let tier = 'Standard';
    let price = basePrice;
    if (r === 0) {
      tier = 'VIP';
      price = actualVip;
    } else if (r === 1 || r === 2) {
      tier = 'Premium';
      price = actualPremium;
    }
    for (let c = 1; c <= cols; c++) {
      seats.push({
        seatNumber: `${rowLetter}${c}`,
        row: rowLetter,
        tier,
        price,
        status: 'available',
        bookedBy: null,
        bookingId: null,
        lockedBy: null,
        lockExpiresAt: null
      });
    }
  }
  return seats;
};

// Automatically release expired temporary seat locks
eventSchema.methods.releaseExpiredSeatLocks = function () {
  if (!this.seatLayout || !Array.isArray(this.seatLayout.seats)) return false;
  const now = new Date();
  let modified = false;
  this.seatLayout.seats.forEach((seat) => {
    if (seat.status === 'available' && seat.lockExpiresAt && new Date(seat.lockExpiresAt) <= now) {
      seat.lockedBy = null;
      seat.lockExpiresAt = null;
      modified = true;
    }
  });
  return modified;
};

module.exports = mongoose.model('Event', eventSchema);

