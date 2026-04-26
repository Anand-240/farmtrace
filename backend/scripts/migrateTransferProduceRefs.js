/**
 * Migration script: Backfill produceMongoId and produceChainId fields on existing Transfer records
 * Run once after deploying the schema update to Transfer model
 * 
 * Usage: node backend/scripts/migrateTransferProduceRefs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Transfer = require('../models/Transfer');
const Produce = require('../models/Produce');

async function runMigration() {
  try {
    console.log('Starting transfer produce reference migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get total count
    const totalTransfers = await Transfer.countDocuments();
    console.log(`Total transfers to process: ${totalTransfers}`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    const batchSize = 100;

    // Process in batches
    for (let skip = 0; skip < totalTransfers; skip += batchSize) {
      const transfers = await Transfer.find()
        .skip(skip)
        .limit(batchSize)
        .lean();

      for (const transfer of transfers) {
        processed++;
        
        try {
          // Skip if already fully populated
          if (transfer.produceMongoId && transfer.produceChainId) {
            skipped++;
            continue;
          }

          let produceMongoId = transfer.produceMongoId;
          let produceChainId = transfer.produceChainId;
          let updates = {};

          // Try to resolve produceMongoId if missing
          if (!produceMongoId && transfer.produceId) {
            // Try as ObjectId
            if (mongoose.Types.ObjectId.isValid(transfer.produceId)) {
              const p = await Produce.findById(transfer.produceId).select('_id produceId');
              if (p) {
                produceMongoId = p._id;
                updates.produceMongoId = produceMongoId;
              }
            }
            
            // If still not found, try as chain ID
            if (!produceMongoId) {
              const p = await Produce.findOne({ produceId: transfer.produceId }).select('_id produceId');
              if (p) {
                produceMongoId = p._id;
                updates.produceMongoId = produceMongoId;
              }
            }
          }

          // Try to resolve produceChainId if missing
          if (!produceChainId && (produceMongoId || transfer.produceId)) {
            const searchId = produceMongoId || transfer.produceId;
            const p = await Produce.findById(searchId).select('produceId');
            if (p && p.produceId) {
              produceChainId = p.produceId;
              updates.produceChainId = produceChainId;
            }
          }

          // Apply updates if any
          if (Object.keys(updates).length > 0) {
            await Transfer.findByIdAndUpdate(transfer._id, { $set: updates });
            updated++;
            if (processed % 20 === 0) {
              console.log(`Processed: ${processed}/${totalTransfers}, Updated: ${updated}`);
            }
          } else {
            skipped++;
          }
        } catch (err) {
          console.error(`Error processing transfer ${transfer._id}:`, err.message);
        }
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (already complete): ${skipped}`);

    // Verify: count how many are now fully populated
    const fullCount = await Transfer.countDocuments({
      produceMongoId: { $exists: true, $ne: null },
      produceChainId: { $exists: true, $ne: null }
    });
    console.log(`Fully populated transfers: ${fullCount}/${totalTransfers}`);

    await mongoose.connection.close();
    console.log('Migration finished');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

// Run migration
runMigration();
