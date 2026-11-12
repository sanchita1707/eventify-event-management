
const mongoose = require('mongoose');

const sanitizeMongoUri = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (cleaned.startsWith('MONGO_URI=')) {
    cleaned = cleaned.slice('MONGO_URI='.length).trim().replace(/^["']|["']$/g, '');
  }
  return cleaned;
};

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const primaryUri = sanitizeMongoUri(process.env.MONGO_URI);
  const localUri = sanitizeMongoUri(process.env.LOCAL_MONGO_URI) || 'mongodb://127.0.0.1:27017/eventify';

  const isPrimaryValid =
    Boolean(primaryUri) &&
    (primaryUri.startsWith('mongodb://') || primaryUri.startsWith('mongodb+srv://')) &&
    !primaryUri.includes('<username>');

  if (isPrimaryValid) {
    try {
      const conn = await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: isProduction ? 10000 : 5000
      });
      console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.warn(`[Database] Primary MONGO_URI connection failed (${error.message}).`);
      if (isProduction) {
        throw error;
      }
      console.log('[Database] Falling back to local MongoDB instance...');
    }
  } else if (isProduction) {
    throw new Error('Valid MONGO_URI (starting with mongodb:// or mongodb+srv://) is required in production environment');
  }

  try {
    const conn = await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[Database] MongoDB Connected (Local): ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database] Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;

