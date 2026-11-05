const Notification = require('../models/Notification');

// @desc    Get logged in user's notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount,
      notifications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a notification or all notifications as read
// @route   PUT /api/notifications/mark-read
// @access  Private
exports.markNotificationsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.body;
    if (notificationId) {
      await Notification.findOneAndUpdate(
        { _id: notificationId, user: req.user._id },
        { isRead: true }
      );
    } else {
      await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    }

    res.status(200).json({
      success: true,
      message: 'Notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
};

