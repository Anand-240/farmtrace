const { Client } = require('@elastic/elasticsearch');
const Produce = require('../models/Produce');

const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_URL,
});

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
    console.log(`Elasticsearch index '${indexName}' created.`);
  }
}

async function startSync() {
  try {
    await setupElasticsearch();
    
    // Perform an initial sync if needed? (Skipping for now to focus on Change Streams)

    console.log('Starting MongoDB Change Stream for Produce collection...');
    
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
          console.log(`Elasticsearch synced insert: ${doc._id}`);
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
          console.log(`Elasticsearch synced update/replace: ${doc._id}`);
        } 
        else if (change.operationType === 'delete') {
          await elasticClient.delete({
            index: 'produce',
            id: change.documentKey._id.toString()
          }, { ignore: [404] });
          console.log(`Elasticsearch synced delete: ${change.documentKey._id}`);
        }
      } catch (err) {
        console.error('Elasticsearch sync error during change stream:', err);
      }
    });

    changeStream.on('error', (err) => {
      console.error('Change Stream Error:', err);
    });

  } catch (err) {
    console.error('Failed to start Elasticsearch sync worker:', err);
  }
}

module.exports = {
  startSync
};
