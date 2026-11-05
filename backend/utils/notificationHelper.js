const Notification = require('../models/Notification');

let ioInstance = null;

const setSocketIO = (io) => {
  ioInstance = io;
};

const getSocketIO = () => ioInstance;

const createNotification = async ({ user, title, message, type = 'system', link = '' }) => {
  try {
    const notification = await Notification.create({
      user,
      title,
      message,
      type,
      link
    });

    if (ioInstance && user) {
      ioInstance.to(`user_${user.toString()}`).emit('new_notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('[Notification Helper] Failed to create notification:', error.message);
    return null;
  }
};

module.exports = { setSocketIO, getSocketIO, createNotification };

