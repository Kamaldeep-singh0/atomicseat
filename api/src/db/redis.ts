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
    const isUpstash = config.redisUrl.includes('upstash.io');
    const isTls = config.redisUrl.startsWith('rediss://') || isUpstash;

    // Convert redis:// to rediss:// for Upstash if needed
    let cleanUrl = config.redisUrl;
    if (isUpstash && cleanUrl.startsWith('redis://')) {
      cleanUrl = cleanUrl.replace('redis://', 'rediss://');
    }

    const options: any = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times: number) {
        return Math.min(times * 150, 3000);
      },
      lazyConnect: false,
    };

    if (isTls) {
      options.tls = {
        rejectUnauthorized: false,
      };
    }

    try {
      redisClient = new Redis(cleanUrl, options);

      redisClient.on('connect', () => {
        console.log(`[Redis] Connected successfully to Redis cluster`);
      });

      redisClient.on('error', (err) => {
        console.warn(`[Redis] Client warning: ${err.message}`);
      });
    } catch (err: any) {
      console.warn(`[Redis] Client init warning: ${err.message}`);
    }
  }

  return redisClient!;
}

export function getRedisSubscriber(customSub?: Redis): Redis {
  if (customSub) {
    redisSubClient = customSub;
    return redisSubClient;
  }

  if (!redisSubClient) {
    try {
      const client = getRedisClient();
      redisSubClient = client.duplicate();
      redisSubClient.on('error', (err) => {
        console.warn(`[Redis Subscriber] Warning: ${err.message}`);
      });
    } catch (err: any) {
      console.warn(`[Redis Subscriber] Init warning: ${err.message}`);
    }
  }

  return redisSubClient!;
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
