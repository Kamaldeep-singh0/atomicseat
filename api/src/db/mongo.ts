import mongoose from 'mongoose';
import { config } from '../config/index.js';

let isConnected = false;

export async function connectMongo(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri || config.mongoUri;
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} (Host: ${conn.connection.host})`);
    return mongoose;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    throw error;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected');
  }
}
