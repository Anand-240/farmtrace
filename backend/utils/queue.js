const { Queue } = require('bullmq');

const connection = {
  url: process.env.REDIS_URL
};

const blockchainQueue = new Queue('blockchainQueue', { connection });

async function pingRedis() {
  const client = await blockchainQueue.client;
  return client.ping();
}

module.exports = {
  blockchainQueue,
  pingRedis
};
