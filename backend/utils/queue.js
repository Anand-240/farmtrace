const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_OPTIONS = {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 2) return null;
    return Math.min(times * 300, 1000);
  }
};

let blockchainQueue = null;

try {
  if (process.env.REDIS_URL) {
    const redisClient = new IORedis(process.env.REDIS_URL, REDIS_OPTIONS);
    redisClient.on('error', () => {}); // suppress — Redis is optional
    blockchainQueue = new Queue('blockchainQueue', { connection: redisClient });
  }
} catch {
  // Redis unavailable — queue features disabled
}

const pingRedis = async () => {
  if (!process.env.REDIS_URL) return false;
  const redis = new IORedis(process.env.REDIS_URL, { ...REDIS_OPTIONS, lazyConnect: true });
  redis.on('error', () => {});
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    return false;
  } finally {
    redis.disconnect();
  }
};

module.exports = { blockchainQueue, pingRedis };
