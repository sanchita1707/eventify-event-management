
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';

    const uri = process.env.MONGO_URI ||
      (!isProduction
        ? process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/eventify'
        : null);

    if (!uri) {
      throw new Error('MONGO_URI is missing in production environment');
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });

    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;

  } catch (error) {
    console.error(`[Database] Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
