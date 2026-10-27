import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { getRedisClient } from '../db/redis.js';

export class HeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private redis: Redis | null = null;
  private isRunning = false;
  private heartbeatIntervalMs = 2500;
  private ttlSeconds = 6;

  constructor(customRedis?: Redis) {
    if (customRedis) {
      this.redis = customRedis;
    }
  }

  private getClient(): Redis {
    if (!this.redis) {
      this.redis = getRedisClient();
    }
    return this.redis;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Send initial heartbeat immediately
    this.sendHeartbeat().catch(() => {});

    this.timer = setInterval(() => {
      this.sendHeartbeat().catch((err) => {
        console.warn(`[Heartbeat] Failed to send heartbeat: ${err.message}`);
      });
    }, this.heartbeatIntervalMs);

    console.log(`[Heartbeat] Started instance heartbeat for ${config.instanceId}`);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;

    try {
      const client = this.getClient();
      await client.del(`heartbeat:instance:${config.instanceId}`);
      console.log(`[Heartbeat] Removed instance heartbeat for ${config.instanceId}`);
    } catch {}
  }

  private async sendHeartbeat(): Promise<void> {
    const client = this.getClient();
    const key = `heartbeat:instance:${config.instanceId}`;
    const payload = JSON.stringify({
      instanceId: config.instanceId,
      timestamp: Date.now(),
      uptime: process.uptime(),
    });

    await client.set(key, payload, 'EX', this.ttlSeconds);
  }

  async getActiveInstances(): Promise<{ count: number; instances: string[] }> {
    try {
      const client = this.getClient();
      const keys = await client.keys('heartbeat:instance:*');
      const instances = keys.map((k) => k.replace('heartbeat:instance:', ''));
      return {
        count: Math.max(instances.length, 1), // At least current instance
        instances: instances.length > 0 ? instances : [config.instanceId],
      };
    } catch (err: any) {
      // In case Redis is unreachable or keys fail, report at least 1 (the current instance)
      return {
        count: 1,
        instances: [config.instanceId],
      };
    }
  }
}

export const heartbeatService = new HeartbeatService();
