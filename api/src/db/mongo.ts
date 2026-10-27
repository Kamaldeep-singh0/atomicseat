import mongoose from 'mongoose';
import { config } from '../config/index.js';

let isConnected = false;
let lastMongoError: string | null = null;

const FALLBACK_URI =
  'mongodb://AtomicSeat:AtomicPass2026%21@ac-h8bu2so-shard-00-00.qvkhkwx.mongodb.net:27017/atomicseat?ssl=true&replicaSet=atlas-z3fm2h-shard-0&authSource=admin&retryWrites=true&w=majority';

export function getLastMongoError(): string | null {
  return lastMongoError;
}

export async function connectMongo(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri || config.mongoUri;
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
      maxPoolSize: 10,
    });
    isConnected = true;
    lastMongoError = null;
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} (Host: ${conn.connection.host})`);
    return mongoose;
  } catch (error: any) {
    isConnected = false;
    lastMongoError = error.message;
    console.warn(`[MongoDB] Primary connection failed: ${error.message}`);

    // If custom/env URI failed, try guaranteed fallback replicaSet URI
    if (!uri && targetUri !== FALLBACK_URI) {
      console.log('[MongoDB] Attempting fallback to direct replicaSet URI...');
      try {
        const fallbackConn = await mongoose.connect(FALLBACK_URI, {
          serverSelectionTimeoutMS: 5000,
          autoIndex: true,
          maxPoolSize: 10,
        });
        isConnected = true;
        lastMongoError = null;
        console.log(`[MongoDB] Connected via fallback URI to: ${fallbackConn.connection.name}`);
        return mongoose;
      } catch (fallbackError: any) {
        lastMongoError = fallbackError.message;
        console.error('[MongoDB] Fallback connection failed:', fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
}

export async function ensureMongoConnected(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    await connectMongo();
  }
}

export async function disconnectMongo(): Promise<void> {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected');
  }
}

