import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  targetApiUrl: process.env.TARGET_API_URL || 'http://localhost:4000',
  maxRushUsers: parseInt(process.env.MAX_RUSH_USERS || '300', 10),
  defaultDurationSeconds: parseInt(process.env.DEFAULT_DURATION_SECONDS || '30', 10),
};
