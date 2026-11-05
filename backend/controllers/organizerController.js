const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const Organizer = require('../models/Organizer');

// @desc    Get organizer dashboard summary & analytics
// @route   GET /api/organizer/dashboard
// @access  Private (Organizer/Admin)
exports.getOrganizerDashboard = async (req, res, next) => {
  try {
    const filter = { organizer: req.user._id };
    const events = await Event.find(filter).select('-seatLayout.seats').sort({ createdAt: -1 });
    const eventIds = events.map((e) => e._id);

    const bookings = await Booking.find({
      event: { $in: eventIds },
      bookingStatus: 'confirmed'
    })
      .populate('event', 'title date venue city')
      .populate('user', 'name email phone')
      .populate('ticketId', 'ticketCode checkInStatus checkedInAt')
      .sort({ createdAt: -1 });

    const totalEvents = events.length;
    const totalBookings = bookings.length;
    const totalTicketsSold = bookings.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalAvailableSeats = events.reduce((sum, e) => sum + (e.availableSeats || 0), 0);
    const checkedInCount = bookings.filter(
      (b) => b.ticketId && b.ticketId.checkInStatus === 'checked_in'
    ).length;

    // Monthly revenue & booking stats for Chart.js
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyStats = monthNames.map((m) => ({ month: m, bookings: 0, revenue: 0 }));

    bookings.forEach((b) => {
      const mIndex = new Date(b.createdAt).getMonth();
      monthlyStats[mIndex].bookings += b.quantity || 1;
      monthlyStats[mIndex].revenue += b.totalAmount || 0;
    });

    // Event-wise performance
    const eventPerformance = events.slice(0, 8).map((e) => {
      const evBookings = bookings.filter(
        (b) => b.event && b.event._id.toString() === e._id.toString()
      );
      const rev = evBookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const sold = evBookings.reduce((sum, b) => sum + b.quantity, 0);
      return {
        _id: e._id,
        title: e.title,
        capacity: e.capacity,
        availableSeats: e.availableSeats,
        ticketsSold: sold,
        revenue: rev,
        status: e.status,
        approvalStatus: e.approvalStatus
      };
    });

    const organizerProfile = await Organizer.findOne({ user: req.user._id });

    res.status(200).json({
      success: true,
      stats: {
        totalEvents,
        totalBookings,
        totalTicketsSold,
        totalRevenue,
        totalAvailableSeats,
        checkedInCount
      },
      organizerProfile,
      monthlyStats,
      eventPerformance,
      recentBookings: bookings.slice(0, 10),
      events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get organizer's events
// @route   GET /api/organizer/events
// @access  Private (Organizer/Admin)
exports.getOrganizerEvents = async (req, res, next) => {
  try {
    const filter = { organizer: req.user._id };
    const events = await Event.find(filter)
      .select('-seatLayout.seats')
      .populate('category', 'name icon color')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bookings & participants for organizer's events
// @route   GET /api/organizer/bookings
// @access  Private (Organizer/Admin)
exports.getOrganizerBookings = async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { organizer: req.user._id };
    if (req.query.eventId) {
      filter._id = req.query.eventId;
    }

    const events = await Event.find(filter).select('_id title');
    const eventIds = events.map((e) => e._id);

    const bookingQuery = { event: { $in: eventIds } };
    if (req.query.status) {
      bookingQuery.bookingStatus = req.query.status;
    }

    const bookings = await Booking.find(bookingQuery)
      .populate('event', 'title date startTime venue city')
      .populate('user', 'name email phone')
      .populate('ticketId', 'ticketCode checkInStatus checkedInAt seats')
      .populate('paymentId', 'razorpayOrderId razorpayPaymentId status amount')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    next(error);
  }
};

