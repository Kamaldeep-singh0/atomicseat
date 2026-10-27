import { Redis } from 'ioredis';
import { config } from '../config/index.js';

let redisClient: Redis | null = null;
let redisSubClient: Redis | null = null;

export function getRedisClient(customClient?: Redis): Redis {
  if (customClient) {
    redisClient = customClient;
    return redisClient;
  }

  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      console.log(`[Redis] Connected successfully to ${config.redisUrl}`);
    });

    redisClient.on('error', (err) => {
      console.warn(`[Redis] Client warning/error: ${err.message}`);
    });
  }

  return redisClient;
}

export function getRedisSubscriber(customSub?: Redis): Redis {
  if (customSub) {
    redisSubClient = customSub;
    return redisSubClient;
  }

  if (!redisSubClient) {
    redisSubClient = getRedisClient().duplicate();
    redisSubClient.on('error', (err) => {
      console.warn(`[Redis Subscriber] Warning/error: ${err.message}`);
    });
  }

  return redisSubClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisSubClient) {
    await redisSubClient.quit().catch(() => {});
    redisSubClient = null;
  }
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
  console.log('[Redis] Disconnected');
}
