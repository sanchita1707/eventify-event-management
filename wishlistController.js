const Wishlist = require('../models/Wishlist');
const Event = require('../models/Event');

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = async (req, res, next) => {
  try {
    const items = await Wishlist.find({ user: req.user._id })
      .populate({
        path: 'event',
        select: '-seatLayout.seats',
        populate: { path: 'category', select: 'name slug icon color' }
      })
      .sort({ createdAt: -1 });

    const validItems = items.filter((i) => i.event !== null);

    res.status(200).json({
      success: true,
      count: validItems.length,
      wishlist: validItems
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle event in user's wishlist (Add / Remove)
// @route   POST /api/wishlist/toggle
// @access  Private
exports.toggleWishlist = async (req, res, next) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const existing = await Wishlist.findOne({ user: req.user._id, event: eventId });
    if (existing) {
      await existing.deleteOne();
      return res.status(200).json({
        success: true,
        saved: false,
        message: 'Event removed from your wishlist'
      });
    } else {
      const item = await Wishlist.create({
        user: req.user._id,
        event: eventId
      });
      return res.status(201).json({
        success: true,
        saved: true,
        message: 'Event saved to your wishlist!',
        item
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Remove event from wishlist
// @route   DELETE /api/wishlist/:eventId
// @access  Private
exports.removeFromWishlist = async (req, res, next) => {
  try {
    await Wishlist.findOneAndDelete({ user: req.user._id, event: req.params.eventId });
    res.status(200).json({
      success: true,
      message: 'Removed from wishlist'
    });
  } catch (error) {
    next(error);
  }
};

