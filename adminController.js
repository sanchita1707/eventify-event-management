const User = require('../models/User');
const Organizer = require('../models/Organizer');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Complaint = require('../models/Complaint');
const Ticket = require('../models/Ticket');
const { createNotification } = require('../utils/notificationHelper');

// @desc    Get comprehensive admin dashboard analytics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getAdminDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalOrganizers,
      totalEvents,
      pendingEventsCount,
      confirmedBookings,
      payments,
      totalReviews,
      openComplaints,
      recentUsers,
      pendingEvents
    ] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'organizer' }),
      Event.countDocuments(),
      Event.countDocuments({ approvalStatus: 'pending' }),
      Booking.find({ bookingStatus: 'confirmed' })
        .populate('event', 'title categoryName date city')
        .populate('user', 'name email')
        .sort({ createdAt: -1 }),
      Payment.find({ status: 'captured' }).sort({ createdAt: -1 }),
      Review.countDocuments(),
      Complaint.countDocuments({ status: 'open' }),
      User.find().select('name email phone role city isActive createdAt').sort({ createdAt: -1 }).limit(8),
      Event.find({ approvalStatus: 'pending' })
        .select('title categoryName organizerName city date ticketPrice capacity availableSeats approvalStatus createdAt')
        .sort({ createdAt: -1 })
    ]);

    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalBookingsCount = confirmedBookings.length;
    const totalTicketsSold = confirmedBookings.reduce((sum, b) => sum + (b.quantity || 0), 0);

    // Monthly revenue and bookings chart
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyStats = monthNames.map((m) => ({ month: m, revenue: 0, bookings: 0 }));

    confirmedBookings.forEach((b) => {
      const m = new Date(b.createdAt).getMonth();
      monthlyStats[m].revenue += b.totalAmount || 0;
      monthlyStats[m].bookings += 1;
    });

    // Category distribution
    const categoryBreakdown = await Event.aggregate([
      { $group: { _id: '$categoryName', count: { $sum: 1 }, bookings: { $sum: '$bookingsCount' } } },
      { $sort: { count: -1 } }
    ]);

    const popularEvents = await Event.find()
      .select('title categoryName city date ticketPrice capacity availableSeats bookingsCount averageRating approvalStatus status')
      .sort({ bookingsCount: -1 })
      .limit(8);

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalOrganizers,
        totalEvents,
        pendingEventsCount,
        totalBookings: totalBookingsCount,
        totalTicketsSold,
        totalRevenue,
        totalReviews,
        openComplaints
      },
      monthlyStats,
      categoryBreakdown,
      popularEvents,
      pendingEvents,
      recentUsers,
      recentBookings: confirmedBookings.slice(0, 10),
      recentPayments: payments.slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users (Admin)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.role) query.role = req.query.role;
    const users = await User.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user active status or role (Admin)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
exports.updateUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);
    if (req.body.role) user.role = req.body.role;

    await user.save();
    res.status(200).json({
      success: true,
      message: `User ${user.name} updated successfully`,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (Admin)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete primary admin account' });
    }
    await user.deleteOne();
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all organizers with their profiles and event counts
// @route   GET /api/admin/organizers
// @access  Private/Admin
exports.getAllOrganizers = async (req, res, next) => {
  try {
    const organizers = await Organizer.find()
      .populate('user', 'name email phone city isActive createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: organizers.length,
      organizers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update organizer verification status
// @route   PUT /api/admin/organizers/:id
// @access  Private/Admin
exports.updateOrganizerVerification = async (req, res, next) => {
  try {
    const organizer = await Organizer.findById(req.params.id).populate('user');
    if (!organizer) {
      return res.status(404).json({ success: false, message: 'Organizer profile not found' });
    }

    if (req.body.verificationStatus) {
      organizer.verificationStatus = req.body.verificationStatus;
    }
    await organizer.save();

    if (organizer.user) {
      await createNotification({
        user: organizer.user._id,
        title: `Organizer Profile ${organizer.verificationStatus.toUpperCase()}`,
        message: `Your organizer account (${organizer.organizationName}) status has been updated to ${organizer.verificationStatus}.`,
        type: 'organizer',
        link: '/organizer/dashboard.html'
      });
    }

    res.status(200).json({
      success: true,
      message: `Organizer verification updated to ${organizer.verificationStatus}`,
      organizer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all events (including pending/rejected) for Admin
// @route   GET /api/admin/events
// @access  Private/Admin
exports.getAllEventsAdmin = async (req, res, next) => {
  try {
    const events = await Event.find()
      .select('-seatLayout.seats')
      .populate('organizer', 'name email')
      .populate('category', 'name')
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

// @desc    Approve or Reject an event (Admin)
// @route   PUT /api/admin/events/:id/approval
// @access  Private/Admin
exports.updateEventApproval = async (req, res, next) => {
  try {
    const { approvalStatus, rejectionReason, isFeatured, isTrending, status, isPublished } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (approvalStatus) {
      event.approvalStatus = approvalStatus;
      if (approvalStatus === 'approved') {
        event.isPublished = true;
        event.isDraft = false;
        event.rejectionReason = '';
        if (event.status === 'draft') event.status = 'upcoming';
      } else if (approvalStatus === 'rejected') {
        event.rejectionReason =
          rejectionReason || event.rejectionReason || 'Event submission did not meet platform moderation guidelines.';
      }
    }
    if (rejectionReason !== undefined && approvalStatus !== 'approved') {
      event.rejectionReason = rejectionReason;
    }
    if (isFeatured !== undefined) event.isFeatured = Boolean(isFeatured);
    if (isTrending !== undefined) event.isTrending = Boolean(isTrending);
    if (isPublished !== undefined) event.isPublished = Boolean(isPublished);
    if (status) event.status = status;

    await event.save();

    const notifMessage =
      event.approvalStatus === 'rejected' && event.rejectionReason
        ? `Your event "${event.title}" was rejected. Reason: ${event.rejectionReason}`
        : `Your event "${event.title}" approval status is now "${event.approvalStatus}".`;

    await createNotification({
      user: event.organizer,
      title: `Event Status Updated: ${event.approvalStatus.toUpperCase()}`,
      message: notifMessage,
      type: 'organizer',
      link: `/organizer/manage-events.html`
    });

    res.status(200).json({
      success: true,
      message: `Event "${event.title}" updated successfully`,
      event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bookings (Admin)
// @route   GET /api/admin/bookings
// @access  Private/Admin
exports.getAllBookingsAdmin = async (req, res, next) => {
  try {
    const bookings = await Booking.find()
      .populate('event', 'title date venue city organizerName')
      .populate('user', 'name email phone')
      .populate('ticketId', 'ticketCode checkInStatus checkedInAt')
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

// @desc    Get all payments (Admin)
// @route   GET /api/admin/payments
// @access  Private/Admin
exports.getAllPaymentsAdmin = async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate('event', 'title date city')
      .populate('booking', 'bookingReference quantity totalAmount bookingStatus')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all reviews & complaints for moderation (Admin)
// @route   GET /api/admin/reviews
// @access  Private/Admin
exports.getAllReviewsAndComplaints = async (req, res, next) => {
  try {
    const [reviews, complaints] = await Promise.all([
      Review.find()
        .populate('user', 'name email')
        .populate('event', 'title')
        .sort({ createdAt: -1 }),
      Complaint.find().sort({ createdAt: -1 })
    ]);

    res.status(200).json({
      success: true,
      reviewsCount: reviews.length,
      complaintsCount: complaints.length,
      reviews,
      complaints
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update complaint status / response (Admin)
// @route   PUT /api/admin/complaints/:id
// @access  Private/Admin
exports.updateComplaintStatus = async (req, res, next) => {
  try {
    const { status, adminResponse } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (status) complaint.status = status;
    if (adminResponse !== undefined) complaint.adminResponse = adminResponse;
    await complaint.save();

    if (complaint.user) {
      await createNotification({
        user: complaint.user,
        title: `Support Ticket Update: ${complaint.subject}`,
        message: adminResponse || `Your support ticket status is now ${complaint.status}.`,
        type: 'system'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Complaint updated successfully',
      complaint
    });
  } catch (error) {
    next(error);
  }
};

