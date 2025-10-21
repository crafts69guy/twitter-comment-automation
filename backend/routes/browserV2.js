import express from 'express';
import puppeteerServiceV2 from '../services/puppeteerServiceV2.js';

const router = express.Router();

/**
 * GET /api/browser/status
 * Get browser connection status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await puppeteerServiceV2.getBrowserStatus();

    // Update session browser status
    req.userSession.browser.isOpen = status.isOpen;
    req.userSession.browser.currentPageUrl = status.currentUrl;
    req.userSession.browser.lastActivityAt = new Date();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error getting browser status:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      isOpen: false
    });
  }
});

/**
 * POST /api/browser/open
 * Initialize browser
 */
router.post('/open', async (req, res) => {
  try {
    await puppeteerServiceV2.initialize();

    const status = await puppeteerServiceV2.getBrowserStatus();

    // Update session
    req.userSession.browser.isOpen = true;
    req.userSession.browser.lastActivityAt = new Date();

    res.json({
      success: true,
      message: 'Browser opened successfully',
      ...status
    });
  } catch (error) {
    console.error('Error opening browser:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/browser/close
 * Close browser
 */
router.post('/close', async (req, res) => {
  try {
    await puppeteerServiceV2.closeBrowser();

    // Update session
    req.userSession.browser.isOpen = false;
    req.userSession.browser.currentPageUrl = null;
    req.userSession.browser.lastActivityAt = new Date();

    res.json({
      success: true,
      message: 'Browser closed successfully'
    });
  } catch (error) {
    console.error('Error closing browser:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
