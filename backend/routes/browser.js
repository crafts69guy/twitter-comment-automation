import express from 'express';
import playwrightService from '../services/playwrightService.js';
import { emitSSE } from '../server.js';

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
 * Initialize browser with auto-login if credentials exist
 */
router.post('/open', async (req, res) => {
  try {
    // Get Twitter credentials from session settings
    const credentials = {
      username: req.userSession.settings.twitterUsername,
      password: req.userSession.settings.twitterPassword,
      verificationHandle: req.userSession.settings.twitterVerificationHandle,
    };

    // Validate credentials
    if (!credentials.username || !credentials.password || !credentials.verificationHandle) {
      return res.status(400).json({
        success: false,
        message:
          'Twitter credentials are required. Please configure username, password, and verification handle in Settings.',
      });
    }

    // Initialize browser with credentials for auto-login
    await playwrightService.initialize(credentials);

    const status = await playwrightService.getBrowserStatus();

    // Update session
    req.userSession.browser.isOpen = true;
    req.userSession.browser.lastActivityAt = new Date();

    // Check if credentials were extracted after login
    let extractedCredentials = null;
    if (playwrightService.extractedCredentials) {
      const extracted = playwrightService.extractedCredentials;

      // Save extracted credentials to session
      req.userSession.settings.twitterBearerToken = extracted.bearerToken;
      req.userSession.settings.twitterCookies = extracted.cookies;

      console.log('✅ Extracted credentials saved to session');

      // Store for response
      extractedCredentials = {
        bearerToken: extracted.bearerToken || '',
        cookies: extracted.cookies || '',
      };

      // Emit SSE event to frontend to update localStorage
      emitSSE(req.userId, 'credentials:extracted', {
        bearerToken: extracted.bearerToken || '',
        cookies: extracted.cookies || '',
        message: 'Bearer Token and Cookies extracted from browser successfully!',
      });

      // Clear from service
      playwrightService.extractedCredentials = null;
    }

    res.json({
      success: true,
      message: 'Browser opened successfully',
      autoLoginAttempted: !!(credentials.username && credentials.password),
      extractedCredentials: extractedCredentials,
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
