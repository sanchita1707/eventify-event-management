const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/eventify';
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database] Connection Error: ${error.message}`);
    if (process.env.LOCAL_MONGO_URI && process.env.MONGO_URI !== process.env.LOCAL_MONGO_URI) {
      try {
        console.log('[Database] Attempting fallback to LOCAL_MONGO_URI...');
        const fallbackConn = await mongoose.connect(process.env.LOCAL_MONGO_URI);
        console.log(`[Database] Local MongoDB Connected: ${fallbackConn.connection.host}`);
        return fallbackConn;
      } catch (fallbackErr) {
        console.error(`[Database] Fallback Connection Error: ${fallbackErr.message}`);
      }
    }
    throw error;
  }
};

module.exports = connectDB;

