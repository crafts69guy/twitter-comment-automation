import express from 'express';
import playwrightService from '../services/playwrightService.js';

const router = express.Router();

/**
 * GET /api/failed-links
 * Get all failed links
 */
router.get('/', (req, res) => {
  try {
    const { failedLinks } = req.userSession;

    // Group by batch number
    const groupedByBatch = failedLinks.reduce((acc, link) => {
      const batchNum = link.batchNumber;
      if (!acc[batchNum]) {
        acc[batchNum] = [];
      }
      acc[batchNum].push(link);
      return acc;
    }, {});

    res.json({
      success: true,
      failedLinks,
      totalFailed: failedLinks.length,
      groupedByBatch
    });
  } catch (error) {
    console.error('Error getting failed links:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/failed-links/retry
 * Retry specific failed links manually
 */
router.post('/retry', async (req, res) => {
  try {
    const { linkIds } = req.body;

    if (!linkIds || !Array.isArray(linkIds) || linkIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'linkIds array is required'
      });
    }

    const { failedLinks } = req.userSession;

    // Find links to retry
    const linksToRetry = failedLinks.filter(link => linkIds.includes(link.linkId));

    if (linksToRetry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching failed links found'
      });
    }

    // Process retry sequentially
    const results = [];

    for (const link of linksToRetry) {
      try {
        const page = await playwrightService.ensureBrowserOpen();

        // Navigate to link
        await page.goto(link.url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        await page.waitForTimeout(3000);

        // Auto-reply
        await playwrightService.autoReplyOnPage(page, link.comment);

        results.push({
          linkId: link.linkId,
          url: link.url,
          status: 'success',
          retriedAt: new Date()
        });

        // Remove from failed links on success
        req.userSession.failedLinks = req.userSession.failedLinks.filter(
          l => l.linkId !== link.linkId
        );

      } catch (error) {
        results.push({
          linkId: link.linkId,
          url: link.url,
          status: 'failed',
          error: error.message,
          retriedAt: new Date()
        });
      }

      // Delay between retries
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `Retry completed: ${successCount} successful, ${failedCount} failed`,
      retriedCount: results.length,
      successCount,
      failedCount,
      results
    });

  } catch (error) {
    console.error('Error retrying failed links:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/failed-links/clear
 * Clear failed links (all or specific ones)
 */
router.post('/clear', (req, res) => {
  try {
    const { linkIds } = req.body;

    if (!linkIds || linkIds.length === 0) {
      // Clear all
      const clearedCount = req.userSession.failedLinks.length;
      req.userSession.failedLinks = [];

      return res.json({
        success: true,
        message: `Cleared all ${clearedCount} failed links`,
        clearedCount
      });
    }

    // Clear specific links
    const initialCount = req.userSession.failedLinks.length;
    req.userSession.failedLinks = req.userSession.failedLinks.filter(
      link => !linkIds.includes(link.linkId)
    );
    const clearedCount = initialCount - req.userSession.failedLinks.length;

    res.json({
      success: true,
      message: `Cleared ${clearedCount} failed links`,
      clearedCount
    });

  } catch (error) {
    console.error('Error clearing failed links:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/failed-links/:linkId
 * Get specific failed link details
 */
router.get('/:linkId', (req, res) => {
  try {
    const { linkId } = req.params;
    const { failedLinks } = req.userSession;

    const link = failedLinks.find(l => l.linkId === linkId);

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Failed link not found'
      });
    }

    res.json({
      success: true,
      link
    });
  } catch (error) {
    console.error('Error getting failed link:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
