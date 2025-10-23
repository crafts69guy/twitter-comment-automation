import express from 'express';
import playwrightService from '../services/playwrightService.js';

const router = express.Router();

/**
 * GET /api/browser/status
 * Get browser connection status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await playwrightService.getBrowserStatus();

    // Update session browser status
    req.userSession.browser.isOpen = status.isOpen;
    req.userSession.browser.currentPageUrl = status.currentUrl;
    req.userSession.browser.lastActivityAt = new Date();

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Error getting browser status:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      isOpen: false,
    });
  }
});

/**
 * POST /api/browser/open
 * Initialize browser (manual login - no auto-login)
 */
router.post('/open', async (req, res) => {
  try {
    // Validate that bearer token and cookies are configured
    const { twitterBearerToken, twitterCookies } = req.userSession.settings;

    if (!twitterBearerToken || !twitterCookies) {
      return res.status(400).json({
        success: false,
        message:
          'Twitter Bearer Token and Cookies are required. Please configure them in Settings before opening browser.',
      });
    }

    // Initialize browser without credentials (no auto-login)
    await playwrightService.initialize();

    const status = await playwrightService.getBrowserStatus();

    // Update session
    req.userSession.browser.isOpen = true;
    req.userSession.browser.lastActivityAt = new Date();

    res.json({
      success: true,
      message: 'Browser opened successfully. Please login manually to Twitter.',
      ...status,
    });
  } catch (error) {
    console.error('Error opening browser:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/browser/close
 * Close browser
 */
router.post('/close', async (req, res) => {
  try {
    await playwrightService.closeBrowser();

    // Update session
    req.userSession.browser.isOpen = false;
    req.userSession.browser.currentPageUrl = null;
    req.userSession.browser.lastActivityAt = new Date();

    res.json({
      success: true,
      message: 'Browser closed successfully',
    });
  } catch (error) {
    console.error('Error closing browser:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
