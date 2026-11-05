const Review = require('../models/Review');
const Event = require('../models/Event');
const Booking = require('../models/Booking');

const recalculateEventRating = async (eventId) => {
  const stats = await Review.aggregate([
    { $match: { event: eventId, status: 'approved' } },
    {
      $group: {
        _id: '$event',
        avgRating: { $avg: '$rating' },
        numReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await Event.findByIdAndUpdate(eventId, {
      averageRating: Number(stats[0].avgRating.toFixed(1)),
      reviewsCount: stats[0].numReviews
    });
  } else {
    await Event.findByIdAndUpdate(eventId, {
      averageRating: 4.5,
      reviewsCount: 0
    });
  }
};

// @desc    Get reviews for an event
// @route   GET /api/reviews/event/:eventId
// @access  Public
exports.getEventReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ event: req.params.eventId, status: 'approved' })
      .populate('user', 'name avatar city')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add or update a review for an event
// @route   POST /api/reviews
// @access  Private
exports.createReview = async (req, res, next) => {
  try {
    const { eventId, rating, title, comment } = req.body;

    if (!eventId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide event ID, star rating, and review comment'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Check if user booked this event
    const confirmedBooking = await Booking.findOne({
      user: req.user._id,
      event: eventId,
      bookingStatus: 'confirmed'
    });

    let review = await Review.findOne({ event: eventId, user: req.user._id });
    if (review) {
      review.rating = Number(rating);
      review.title = title ? title.trim() : review.title;
      review.comment = comment.trim();
      review.isVerifiedAttendee = Boolean(confirmedBooking);
      await review.save();
    } else {
      review = await Review.create({
        event: eventId,
        user: req.user._id,
        rating: Number(rating),
        title: title ? title.trim() : '',
        comment: comment.trim(),
        isVerifiedAttendee: Boolean(confirmedBooking)
      });
    }

    await recalculateEventRating(event._id);

    const populated = await Review.findById(review._id).populate('user', 'name avatar city');

    res.status(201).json({
      success: true,
      message: 'Thank you! Your review has been published.',
      review: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a review (Owner or Admin)
// @route   DELETE /api/reviews/:id
// @access  Private
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this review' });
    }

    const eventId = review.event;
    await review.deleteOne();
    await recalculateEventRating(eventId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

