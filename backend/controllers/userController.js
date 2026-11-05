const User = require('../models/User');
const Booking = require('../models/Booking');
const Wishlist = require('../models/Wishlist');
const Certificate = require('../models/Certificate');
const Notification = require('../models/Notification');
const Event = require('../models/Event');
const Complaint = require('../models/Complaint');

// @desc    Get user profile and summary stats
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const totalBookings = await Booking.countDocuments({ user: req.user._id, bookingStatus: 'confirmed' });
    const wishlistDocs = await Wishlist.find({ user: req.user._id }).populate('event', '_id');
    const wishlistCount = wishlistDocs.filter((i) => i.event !== null).length;
    const certificatesCount = await Certificate.countDocuments({ user: req.user._id });

    res.status(200).json({
      success: true,
      user,
      stats: {
        totalBookings,
        wishlistCount,
        certificatesCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comprehensive customer dashboard data
// @route   GET /api/users/dashboard
// @access  Private (Customer / Authenticated User)
exports.getCustomerDashboard = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    const [bookings, wishlistItems, notifications, certificates] = await Promise.all([
      Booking.find({ user: req.user._id })
        .populate('event', 'title poster date startTime endTime venue address city categoryName status certificateEligible ticketPrice')
        .populate('ticketId', 'ticketCode qrCodeDataUrl checkInStatus checkedInAt seats')
        .populate('paymentId', 'razorpayOrderId razorpayPaymentId status amount')
        .sort({ createdAt: -1 }),
      Wishlist.find({ user: req.user._id })
        .populate({
          path: 'event',
          select: '-seatLayout.seats',
          populate: { path: 'category', select: 'name slug icon color' }
        })
        .sort({ createdAt: -1 }),
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(15),
      Certificate.find({ user: req.user._id }).sort({ issuedAt: -1 })
    ]);

    const validWishlist = wishlistItems.filter((item) => item.event !== null);
    const confirmedBookings = bookings.filter((b) => b.bookingStatus === 'confirmed' && b.event);
    const now = new Date();

    const upcomingBookings = confirmedBookings.filter((b) => {
      const evDate = new Date(b.event.date);
      return evDate >= now && b.event.status !== 'completed';
    });

    const completedBookings = confirmedBookings.filter((b) => {
      const evDate = new Date(b.event.date);
      const isCheckedIn = b.ticketId && b.ticketId.checkInStatus === 'checked_in';
      return evDate < now || b.event.status === 'completed' || isCheckedIn;
    });

    const myTickets = confirmedBookings
      .filter((b) => b.ticketId)
      .map((b) => ({
        _id: b.ticketId._id,
        ticketCode: b.ticketId.ticketCode,
        qrCodeDataUrl: b.ticketId.qrCodeDataUrl,
        checkInStatus: b.ticketId.checkInStatus,
        checkedInAt: b.ticketId.checkedInAt,
        seats: b.ticketId.seats,
        bookingId: b._id,
        bookingReference: b.bookingReference,
        totalAmount: b.totalAmount,
        event: b.event
      }));

    // Build personalized recommended events
    const preferredCategories = [...(user.interests || [])];
    confirmedBookings.forEach((b) => {
      if (b.event && b.event.categoryName) preferredCategories.push(b.event.categoryName);
    });
    validWishlist.forEach((w) => {
      if (w.event && w.event.categoryName) preferredCategories.push(w.event.categoryName);
    });

    const bookedEventIds = confirmedBookings.map((b) => b.event._id);
    let recommendedEvents = [];

    if (preferredCategories.length > 0) {
      const regexCategories = preferredCategories.map((c) => new RegExp(c, 'i'));
      recommendedEvents = await Event.find({
        _id: { $nin: bookedEventIds },
        approvalStatus: 'approved',
        status: 'upcoming',
        $or: [{ categoryName: { $in: regexCategories } }, { tags: { $in: regexCategories } }]
      })
        .select('-seatLayout.seats')
        .populate('category', 'name slug icon color')
        .sort({ averageRating: -1, bookingsCount: -1 })
        .limit(3);
    }

    if (recommendedEvents.length < 3) {
      const excludeIds = [...bookedEventIds, ...recommendedEvents.map((e) => e._id)];
      const fallback = await Event.find({
        _id: { $nin: excludeIds },
        approvalStatus: 'approved',
        status: 'upcoming'
      })
        .select('-seatLayout.seats')
        .populate('category', 'name slug icon color')
        .sort({ isTrending: -1, bookingsCount: -1 })
        .limit(3 - recommendedEvents.length);

      recommendedEvents = [...recommendedEvents, ...fallback];
    }

    res.status(200).json({
      success: true,
      user,
      stats: {
        totalBookings: confirmedBookings.length,
        upcomingEvents: upcomingBookings.length,
        completedEvents: completedBookings.length,
        savedEvents: validWishlist.length,
        certificatesCount: certificates.length
      },
      upcomingBookings,
      recentBookings: bookings.slice(0, 6),
      myTickets,
      wishlist: validWishlist,
      recommendedEvents,
      notifications,
      certificates
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res, next) => {
  try {
    const { name, phone, city, bio, interests, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (city !== undefined) user.city = city.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (avatar !== undefined) user.avatar = avatar;
    if (Array.isArray(interests)) user.interests = interests;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user password
// @route   PUT /api/users/password
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current password and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit contact/support complaint message
// @route   POST /api/users/contact
// @access  Public / Optional Auth
exports.submitContactMessage = async (req, res, next) => {
  try {
    const { name, email, subject, message, category } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields'
      });
    }

    const complaint = await Complaint.create({
      user: req.user ? req.user._id : null,
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      category: category || 'general'
    });

    res.status(201).json({
      success: true,
      message: 'Your inquiry has been submitted. Our support team will respond shortly!',
      complaint
    });
  } catch (error) {
    next(error);
  }
};

