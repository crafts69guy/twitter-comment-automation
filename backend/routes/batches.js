import express from 'express';

const router = express.Router();

/**
 * GET /api/batches/current
 * Get current batch details with progress
 */
router.get('/current', (req, res) => {
  try {
    const { currentBatch, batches } = req.userSession;

    if (!currentBatch) {
      return res.json({
        success: true,
        currentBatch: null,
        message: 'No batch currently processing',
      });
    }

    const batch = batches.find(b => b.batchId === currentBatch.batchId);

    if (!batch) {
      return res.json({
        success: true,
        currentBatch: null,
        message: 'Current batch not found',
      });
    }

    const progress = {
      current: currentBatch.currentLinkIndex + 1,
      total: batch.links.length,
      percentage: Math.round(((currentBatch.currentLinkIndex + 1) / batch.links.length) * 100),
    };

    // Get the current link being processed
    const currentLink = batch.links[currentBatch.currentLinkIndex] || null;

    res.json({
      success: true,
      currentBatch: {
        ...currentBatch,
        currentLink: currentLink, // Add current link object
        currentLinkStatus: currentBatch.currentLinkStatus || null, // Add detailed status
        batch: {
          batchId: batch.batchId,
          batchNumber: batch.batchNumber,
          links: batch.links,
          status: batch.status,
          successCount: batch.successCount,
          failedCount: batch.failedCount,
          results: batch.results || [], // Include results for status tracking
        },
        progress,
      },
    });
  } catch (error) {
    console.error('Error getting current batch:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/batches/history
 * Get all batches
 */
router.get('/history', (req, res) => {
  try {
    const { batches } = req.userSession;

    const history = batches.map(batch => ({
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      status: batch.status,
      totalLinks: batch.links.length,
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      startTime: batch.startTime,
      endTime: batch.endTime,
    }));

    res.json({
      success: true,
      batches: history,
      totalBatches: batches.length,
    });
  } catch (error) {
    console.error('Error getting batch history:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/batches/:batchId
 * Get specific batch details
 */
router.get('/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    const { batches } = req.userSession;

    const batch = batches.find(b => b.batchId === batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    res.json({
      success: true,
      batch: {
        ...batch,
        links: batch.links.map(link => ({
          id: link.id,
          url: link.url,
          content: link.content,
          comment: link.comment,
        })),
        results: batch.results,
      },
    });
  } catch (error) {
    console.error('Error getting batch details:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
