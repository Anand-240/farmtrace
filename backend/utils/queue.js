const { Queue } = require('bullmq');

const connection = {
  url: process.env.REDIS_URL
};

const blockchainQueue = new Queue('blockchainQueue', { connection });

module.exports = {
  blockchainQueue
};
