const elasticClient = require('../utils/elasticClient');
const Produce = require('../models/Produce');
const logger = require('../utils/logger').child({ module: 'elasticSyncWorker' });

async function setupElasticsearch() {
  const indexName = 'produce';
  const exists = await elasticClient.indices.exists({ index: indexName });

  if (!exists) {
    await elasticClient.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            farmerName: { type: 'text' },
            cropType: { type: 'text' },
            origin: { type: 'text' },
            qualityGrade: { type: 'keyword' },
            farmPrice: { type: 'float' },
            lotStatus: { type: 'keyword' },
            quantity: { type: 'float' },
            createdAt: { type: 'date' },
          }
        }
      }
    });
    logger.info({ index: indexName }, 'Elasticsearch index created');
  }
}

async function startSync() {
  try {
    await setupElasticsearch();

    logger.info('Starting MongoDB Change Stream for Produce collection');

    const changeStream = Produce.watch([], { fullDocument: 'updateLookup' });

    changeStream.on('change', async (change) => {
      try {
        if (change.operationType === 'insert') {
          const doc = change.fullDocument;
          await elasticClient.index({
            index: 'produce',
            id: doc._id.toString(),
            document: {
              farmerName: doc.farmerName,
              cropType: doc.cropType,
              origin: doc.origin,
              qualityGrade: doc.qualityGrade,
              farmPrice: doc.farmPrice,
              lotStatus: doc.lotStatus,
              quantity: doc.quantity,
              createdAt: doc.createdAt
            }
          });
          logger.info({ produceId: doc._id }, 'Elasticsearch synced insert');
        }
        else if (change.operationType === 'update' || change.operationType === 'replace') {
          const doc = change.fullDocument;
          await elasticClient.index({
            index: 'produce',
            id: doc._id.toString(),
            document: {
              farmerName: doc.farmerName,
              cropType: doc.cropType,
              origin: doc.origin,
              qualityGrade: doc.qualityGrade,
              farmPrice: doc.farmPrice,
              lotStatus: doc.lotStatus,
              quantity: doc.quantity,
              createdAt: doc.createdAt
            }
          });
          logger.info({ produceId: doc._id, op: change.operationType }, 'Elasticsearch synced update');
        }
        else if (change.operationType === 'delete') {
          await elasticClient.delete({
            index: 'produce',
            id: change.documentKey._id.toString()
          }, { ignore: [404] });
          logger.info({ produceId: change.documentKey._id }, 'Elasticsearch synced delete');
        }
      } catch (err) {
        logger.error({ err, op: change.operationType }, 'Elasticsearch sync error during change stream');
      }
    });

    changeStream.on('error', (err) => {
      logger.error({ err }, 'MongoDB Change Stream error');
    });

  } catch (err) {
    logger.error({ err }, 'Failed to start Elasticsearch sync worker');
  }
}

module.exports = { startSync };
