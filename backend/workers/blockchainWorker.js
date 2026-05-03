const { Worker } = require('bullmq');
const { registerOnChain, transferOnChain } = require('../blockchain/blockchainService');
const Produce = require('../models/Produce');
const Transfer = require('../models/Transfer');
const logger = require('../utils/logger').child({ module: 'blockchainWorker' });

const connection = {
  url: process.env.REDIS_URL
};

const blockchainWorker = new Worker('blockchainQueue', async job => {
  const { type, data, produceMongoId, transferId, transferMongoId } = job.data;
  const targetTransferId = transferId || transferMongoId;

  logger.info({ jobId: job.id, type, produceMongoId, transferId: targetTransferId }, 'Processing blockchain job');

  try {
    if (type === 'REGISTER') {
      const { farmerName, cropType, origin, farmPrice } = data;
      const result = await registerOnChain(farmerName, cropType, origin, farmPrice);
      
      if (result.success && produceMongoId) {
        await Produce.findByIdAndUpdate(produceMongoId, {
          produceId: result.produceId,
          txHash: result.txHash,
          blockchainStatus: 'CONFIRMED'
        });
      } else if (!result.success && produceMongoId) {
        await Produce.findByIdAndUpdate(produceMongoId, { blockchainStatus: 'FAILED' });
      }
      return result;
    }

    if (type === 'TRANSFER') {
      const { produceChainId, produceId, toAddress, price, location } = data;
      const targetChainId = produceChainId || produceId;
      const result = await transferOnChain(targetChainId, toAddress, price, location);
      
      if (result.success && targetTransferId) {
        await Transfer.findByIdAndUpdate(targetTransferId, {
          txHash: result.txHash,
          blockchainStatus: 'CONFIRMED'
        });
      } else if (!result.success && targetTransferId) {
        await Transfer.findByIdAndUpdate(targetTransferId, { blockchainStatus: 'FAILED' });
      }
      return result;
    }
  } catch (err) {
    logger.error({ err, jobId: job.id }, 'Worker error');
    throw err;
  }

  throw new Error(`Unknown job type: ${type}`);
}, { connection });

blockchainWorker.on('completed', (job, returnvalue) => {
  logger.info({ jobId: job.id, txHash: returnvalue?.txHash }, 'Blockchain job completed');
});

blockchainWorker.on('failed', (job, err) => {
  logger.error({ jobId: job.id, err }, 'Blockchain job failed');
});

module.exports = blockchainWorker;
