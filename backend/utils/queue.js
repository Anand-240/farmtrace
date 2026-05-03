const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = {
  url: process.env.REDIS_URL
};

const blockchainQueue = new Queue('blockchainQueue', { connection });

const pingRedis = async () => {
  const redis = new IORedis(process.env.REDIS_URL);
  try {
    await redis.ping();
    return true;
  } finally {
    await redis.quit();
  }
};

module.exports = {
  blockchainQueue,
  pingRedis
};
