const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const { blockchainQueue } = require('../../utils/queue');
const logger = require('../../utils/logger').child({ module: 'jobs' });

router.get('/:id', auth, async (req, res) => {
  try {
    if (!blockchainQueue) return res.status(503).json({ message: 'Queue unavailable (Redis offline)' });
    const job = await blockchainQueue.getJob(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    res.json({
      success: true,
      id: job.id,
      state,
      progress,
      result,
      failedReason
    });
  } catch (err) {
    logger.error({ err, jobId: req.params.id }, 'Job check error');
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
