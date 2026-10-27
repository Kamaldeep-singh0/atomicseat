import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

export type LockStrategyType = 'naive' | 'mongo-atomic' | 'redis-lock';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/atomicseat',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'atomic_seat_default_secret_key_change_in_prod',
  lockStrategy: (process.env.LOCK_STRATEGY as LockStrategyType) || 'mongo-atomic',
  lockDurationMs: parseInt(process.env.LOCK_DURATION_MS || '300000', 10), // 5 minutes
  maxRushUsers: parseInt(process.env.MAX_RUSH_USERS || '300', 10),
  instanceId: process.env.INSTANCE_ID || `inst_${crypto.randomUUID().slice(0, 8)}`,
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
