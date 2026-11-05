const Event = require('../models/Event');
const Category = require('../models/Category');
const Booking = require('../models/Booking');
const Wishlist = require('../models/Wishlist');
const Organizer = require('../models/Organizer');
const { createNotification } = require('../utils/notificationHelper');

// @desc    Get all approved events with filtering, search, sorting, pagination
// @route   GET /api/events
// @access  Public
exports.getEvents = async (req, res, next) => {
  try {
    const {
      search,
      category,
      city,
      minPrice,
      maxPrice,
      dateFrom,
      dateTo,
      featured,
      trending,
      status,
      sort,
      page = 1,
      limit = 12
    } = req.query;

    const query = {
      approvalStatus: 'approved',
      isPublished: { $ne: false },
      isDraft: { $ne: true }
    };

    if (status) {
      query.status = status;
    } else {
      query.status = { $nin: ['cancelled', 'draft'] };
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: regex },
        { description: regex },
        { city: regex },
        { venue: regex },
        { categoryName: regex },
        { tags: regex }
      ];
    }

    if (category && category !== 'all') {
      if (/^[0-9a-fA-F]{24}$/.test(category)) {
        query.category = category;
      } else {
        query.categoryName = new RegExp(`^${category}$`, 'i');
      }
    }

    if (city && city !== 'all') {
      query.city = new RegExp(`^${city}$`, 'i');
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.ticketPrice = {};
      if (minPrice !== undefined && minPrice !== '') query.ticketPrice.$gte = Number(minPrice);
      if (maxPrice !== undefined && maxPrice !== '') query.ticketPrice.$lte = Number(maxPrice);
    }

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    if (featured === 'true') query.isFeatured = true;
    if (trending === 'true') query.isTrending = true;

    let sortOption = { date: 1 };
    if (sort === 'price_asc') sortOption = { ticketPrice: 1 };
    if (sort === 'price_desc') sortOption = { ticketPrice: -1 };
    if (sort === 'popular') sortOption = { bookingsCount: -1, viewsCount: -1 };
    if (sort === 'rating') sortOption = { averageRating: -1 };
    if (sort === 'newest') sortOption = { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const total = await Event.countDocuments(query);
    const events = await Event.find(query)
      .select('-seatLayout.seats')
      .populate('category', 'name slug icon color')
      .populate('organizer', 'name email')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get smart recommended events based on user interests, wishlist, and bookings
// @route   GET /api/events/recommendations
// @access  Public / Optional Auth
exports.getRecommendedEvents = async (req, res, next) => {
  try {
    let preferredCategories = [];
    let preferredCities = [];

    if (req.user) {
      if (Array.isArray(req.user.interests) && req.user.interests.length > 0) {
        preferredCategories.push(...req.user.interests);
      }
      if (req.user.city) {
        preferredCities.push(req.user.city);
      }

      const userBookings = await Booking.find({ user: req.user._id }).populate('event', 'categoryName city');
      userBookings.forEach((b) => {
        if (b.event && b.event.categoryName) preferredCategories.push(b.event.categoryName);
        if (b.event && b.event.city) preferredCities.push(b.event.city);
      });

      const userWishlist = await Wishlist.find({ user: req.user._id }).populate('event', 'categoryName city');
      userWishlist.forEach((w) => {
        if (w.event && w.event.categoryName) preferredCategories.push(w.event.categoryName);
      });
    }

    if (req.query.interests) {
      const queryInterests = req.query.interests.split(',').map((i) => i.trim());
      preferredCategories.push(...queryInterests);
    }

    let events = [];

    if (preferredCategories.length > 0) {
      const regexCategories = preferredCategories.map((c) => new RegExp(c, 'i'));
      events = await Event.find({
        approvalStatus: 'approved',
        status: 'upcoming',
        $or: [{ categoryName: { $in: regexCategories } }, { tags: { $in: regexCategories } }]
      })
        .select('-seatLayout.seats')
        .populate('category', 'name slug icon color')
        .sort({ averageRating: -1, bookingsCount: -1 })
        .limit(6);
    }

    // Fill remaining slots with top rated / trending events if fewer than 4 matched
    if (events.length < 4) {
      const existingIds = events.map((e) => e._id);
      const fallbackEvents = await Event.find({
        _id: { $nin: existingIds },
        approvalStatus: 'approved',
        status: 'upcoming'
      })
        .select('-seatLayout.seats')
        .populate('category', 'name slug icon color')
        .sort({ isTrending: -1, bookingsCount: -1, averageRating: -1 })
        .limit(6 - events.length);

      events = [...events, ...fallbackEvents];
    }

    res.status(200).json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single event details including live seat map
// @route   GET /api/events/:id
// @access  Public (Approved & Published) / Private (Owner Organizer or Admin)
exports.getEventById = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('category', 'name slug icon color')
      .populate('organizer', 'name email phone avatar');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const isOwnerOrAdmin =
      req.user &&
      (req.user.role === 'admin' ||
        (event.organizer &&
          (event.organizer._id || event.organizer).toString() === req.user._id.toString()));

    // Only show approved and published events to customers / public
    if (
      !isOwnerOrAdmin &&
      (event.approvalStatus !== 'approved' || event.isPublished === false || event.isDraft === true)
    ) {
      return res.status(403).json({
        success: false,
        message: 'This event is pending approval or not publicly published yet'
      });
    }

    // Release any expired temporary seat locks
    if (typeof event.releaseExpiredSeatLocks === 'function') {
      event.releaseExpiredSeatLocks();
    }

    event.viewsCount = (event.viewsCount || 0) + 1;
    await event.save();

    res.status(200).json({
      success: true,
      event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new event (Organizer or Admin)
// @route   POST /api/events
// @access  Private (Organizer/Admin)
exports.createEvent = async (req, res, next) => {
  try {
    const {
      title,
      description,
      shortDescription,
      category,
      date,
      endDate,
      startTime,
      endTime,
      venue,
      address,
      city,
      ticketType,
      ticketPrice,
      vipPrice,
      premiumPrice,
      capacity,
      maxTicketsPerCustomer,
      termsAndConditions,
      eventSchedule,
      rows = 6,
      cols = 10,
      tags,
      certificateEligible,
      posterUrl,
      speakersOrArtists,
      isDraft
    } = req.body;

    if (!title || !description || !category || !date || !venue || !address || !city || ticketPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required event details'
      });
    }

    const parsedDate = new Date(date);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (isNaN(parsedDate.getTime()) || parsedDate < todayStart) {
      return res.status(400).json({
        success: false,
        message: 'Event date must be today or a future date'
      });
    }

    const basePrice = Number(ticketPrice);
    if (isNaN(basePrice) || basePrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Ticket price must be a valid non-negative number'
      });
    }

    let categoryDoc = null;
    if (/^[0-9a-fA-F]{24}$/.test(category)) {
      categoryDoc = await Category.findById(category);
    } else {
      categoryDoc = await Category.findOne({ name: new RegExp(`^${category}$`, 'i') });
    }

    if (!categoryDoc) {
      categoryDoc = await Category.findOne();
    }

    const numRows = Math.min(Math.max(Number(rows) || 6, 2), 15);
    const numCols = Math.min(Math.max(Number(cols) || 10, 4), 20);
    const vPrice = vipPrice !== undefined && vipPrice !== '' ? Number(vipPrice) : Math.round(basePrice * 2);
    const pPrice = premiumPrice !== undefined && premiumPrice !== '' ? Number(premiumPrice) : Math.round(basePrice * 1.5);

    if (vPrice < 0 || pPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Tier prices cannot be negative'
      });
    }

    const generatedSeats = Event.generateSeats(numRows, numCols, basePrice, vPrice, pPrice);
    const totalCapacity = generatedSeats.length;

    if (capacity !== undefined && Number(capacity) < 1) {
      return res.status(400).json({
        success: false,
        message: 'Total capacity must be at least 1'
      });
    }

    const maxPerCust = Math.min(Math.max(Number(maxTicketsPerCustomer) || 10, 1), 50);

    let poster = posterUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80';
    if (req.file) {
      poster = `/uploads/${req.file.filename}`;
    }

    const slug =
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString().slice(-5);

    let parsedTags = [];
    if (typeof tags === 'string') {
      parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (Array.isArray(tags)) {
      parsedTags = tags;
    }

    let parsedSpeakers = [];
    if (typeof speakersOrArtists === 'string') {
      try {
        parsedSpeakers = JSON.parse(speakersOrArtists);
      } catch (e) {
        parsedSpeakers = [];
      }
    } else if (Array.isArray(speakersOrArtists)) {
      parsedSpeakers = speakersOrArtists;
    }

    let parsedSchedule = [];
    if (typeof eventSchedule === 'string') {
      try {
        parsedSchedule = JSON.parse(eventSchedule);
      } catch (e) {
        parsedSchedule = [];
      }
    } else if (Array.isArray(eventSchedule)) {
      parsedSchedule = eventSchedule;
    }

    const organizerProfile = await Organizer.findOne({ user: req.user._id });
    const organizerName = organizerProfile ? organizerProfile.organizationName : req.user.name;

    const draftFlag = isDraft === 'true' || isDraft === true;
    // New events must have a pending approval status by default
    const approvalStatus = 'pending';

    const event = await Event.create({
      title: title.trim(),
      slug,
      description,
      shortDescription: shortDescription || description.substring(0, 180),
      category: categoryDoc._id,
      categoryName: categoryDoc.name,
      organizer: req.user._id,
      organizerName,
      poster,
      date: parsedDate,
      endDate: endDate ? new Date(endDate) : parsedDate,
      startTime: startTime || '18:00',
      endTime: endTime || '21:00',
      venue: venue.trim(),
      address: address.trim(),
      city: city.trim(),
      ticketType: ticketType || 'Multi-Tier Seated (VIP, Premium & Standard)',
      ticketPrice: basePrice,
      vipPrice: vPrice,
      premiumPrice: pPrice,
      capacity: totalCapacity,
      availableSeats: totalCapacity,
      maxTicketsPerCustomer: maxPerCust,
      termsAndConditions:
        termsAndConditions ||
        '1. Entry requires a valid EVENTIFY Smart QR Ticket and government photo ID.\n2. Please arrive at least 30 minutes before the scheduled start time.\n3. Duplicate QR scans are strictly blocked by the anti-fraud entry system.',
      eventSchedule: parsedSchedule,
      hasSeatingChart: true,
      seatLayout: {
        rows: numRows,
        cols: numCols,
        seats: generatedSeats
      },
      tags: parsedTags,
      certificateEligible: certificateEligible !== 'false' && certificateEligible !== false,
      isDraft: draftFlag,
      isPublished: !draftFlag,
      approvalStatus,
      status: draftFlag ? 'draft' : 'upcoming',
      speakersOrArtists: parsedSpeakers
    });

    if (organizerProfile) {
      organizerProfile.totalEventsHosted += 1;
      await organizerProfile.save();
    }

    await createNotification({
      user: req.user._id,
      title: draftFlag ? 'Event Saved as Draft' : 'Event Submitted for Approval',
      message: draftFlag
        ? `Your event "${event.title}" has been saved as a draft.`
        : `Your event "${event.title}" (${totalCapacity} seats) has been submitted for admin approval.`,
      type: 'organizer',
      link: `/organizer/manage-events.html`
    });

    res.status(201).json({
      success: true,
      message: draftFlag
        ? 'Event saved as draft successfully'
        : 'Event created and submitted for admin approval',
      event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an event
// @route   PUT /api/events/:id
// @access  Private (Organizer owner or Admin)
exports.updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this event'
      });
    }

    const bookedSeatsCount =
      event.seatLayout && Array.isArray(event.seatLayout.seats)
        ? event.seatLayout.seats.filter((s) => s.status === 'booked').length
        : 0;
    const hasBookings = (event.bookingsCount || 0) > 0 || bookedSeatsCount > 0;

    // Prevent unsafe changes to event capacity or ticket pricing after bookings have been made
    if (hasBookings) {
      const priceChanging =
        (req.body.ticketPrice !== undefined && Number(req.body.ticketPrice) !== event.ticketPrice) ||
        (req.body.vipPrice !== undefined && Number(req.body.vipPrice) !== event.vipPrice) ||
        (req.body.premiumPrice !== undefined && Number(req.body.premiumPrice) !== event.premiumPrice);

      const layoutChanging =
        (req.body.capacity !== undefined && Number(req.body.capacity) !== event.capacity) ||
        (req.body.rows !== undefined && Number(req.body.rows) !== event.seatLayout.rows) ||
        (req.body.cols !== undefined && Number(req.body.cols) !== event.seatLayout.cols);

      if (priceChanging || layoutChanging) {
        return res.status(400).json({
          success: false,
          message:
            'Unsafe modification blocked: Cannot change ticket pricing or seating capacity after bookings have already been made.'
        });
      }
    }

    const fieldsToUpdate = [
      'title',
      'description',
      'shortDescription',
      'startTime',
      'endTime',
      'venue',
      'address',
      'city',
      'ticketType',
      'termsAndConditions',
      'status',
      'isFeatured',
      'isTrending',
      'certificateEligible',
      'isPublished',
      'isDraft'
    ];

    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (['isFeatured', 'isTrending', 'certificateEligible', 'isPublished', 'isDraft'].includes(field)) {
          event[field] = req.body[field] === 'true' || req.body[field] === true;
        } else {
          event[field] = req.body[field];
        }
      }
    });

    if (req.body.maxTicketsPerCustomer !== undefined) {
      event.maxTicketsPerCustomer = Math.min(Math.max(Number(req.body.maxTicketsPerCustomer) || 10, 1), 50);
    }

    if (req.body.date) {
      const newDate = new Date(req.body.date);
      if (isNaN(newDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid event date' });
      }
      event.date = newDate;
    }

    if (!hasBookings) {
      let regenerateLayout = false;
      if (req.body.ticketPrice !== undefined) {
        const p = Number(req.body.ticketPrice);
        if (p < 0) return res.status(400).json({ success: false, message: 'Price cannot be negative' });
        if (p !== event.ticketPrice) regenerateLayout = true;
        event.ticketPrice = p;
      }
      if (req.body.vipPrice !== undefined) {
        const vp = Number(req.body.vipPrice);
        if (vp < 0) return res.status(400).json({ success: false, message: 'VIP price cannot be negative' });
        if (vp !== event.vipPrice) regenerateLayout = true;
        event.vipPrice = vp;
      }
      if (req.body.premiumPrice !== undefined) {
        const pp = Number(req.body.premiumPrice);
        if (pp < 0) return res.status(400).json({ success: false, message: 'Premium price cannot be negative' });
        if (pp !== event.premiumPrice) regenerateLayout = true;
        event.premiumPrice = pp;
      }

      const newRows = req.body.rows !== undefined ? Math.min(Math.max(Number(req.body.rows) || 6, 2), 15) : event.seatLayout.rows;
      const newCols = req.body.cols !== undefined ? Math.min(Math.max(Number(req.body.cols) || 10, 4), 20) : event.seatLayout.cols;
      if (newRows !== event.seatLayout.rows || newCols !== event.seatLayout.cols) {
        regenerateLayout = true;
      }

      if (regenerateLayout) {
        const newSeats = Event.generateSeats(
          newRows,
          newCols,
          event.ticketPrice,
          event.vipPrice || Math.round(event.ticketPrice * 2),
          event.premiumPrice || Math.round(event.ticketPrice * 1.5)
        );
        event.seatLayout.rows = newRows;
        event.seatLayout.cols = newCols;
        event.seatLayout.seats = newSeats;
        event.capacity = newSeats.length;
        event.availableSeats = newSeats.length;
      }
    }

    if (req.body.submitForApproval === 'true' || req.body.submitForApproval === true) {
      event.isDraft = false;
      event.isPublished = true;
      if (event.status === 'draft') event.status = 'upcoming';
      if (event.approvalStatus === 'rejected') {
        event.approvalStatus = 'pending';
        event.rejectionReason = '';
      }
    }

    if (req.body.category && /^[0-9a-fA-F]{24}$/.test(req.body.category)) {
      const catDoc = await Category.findById(req.body.category);
      if (catDoc) {
        event.category = catDoc._id;
        event.categoryName = catDoc.name;
      }
    }

    if (req.file) {
      event.poster = `/uploads/${req.file.filename}`;
    } else if (req.body.posterUrl) {
      event.poster = req.body.posterUrl;
    }

    if (req.body.tags !== undefined) {
      event.tags =
        typeof req.body.tags === 'string'
          ? req.body.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : req.body.tags;
    }

    if (req.body.eventSchedule !== undefined) {
      if (typeof req.body.eventSchedule === 'string') {
        try {
          event.eventSchedule = JSON.parse(req.body.eventSchedule);
        } catch (e) {}
      } else if (Array.isArray(req.body.eventSchedule)) {
        event.eventSchedule = req.body.eventSchedule;
      }
    }

    await event.save();

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an event
// @route   DELETE /api/events/:id
// @access  Private (Organizer owner or Admin)
exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }

    await event.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

