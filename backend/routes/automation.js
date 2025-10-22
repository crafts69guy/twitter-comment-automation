import express from 'express';
import AutomationController from '../controllers/automationController.js';
import playwrightService from '../services/playwrightService.js';

const router = express.Router();

// Store active controllers per user
const activeControllers = new Map();

// Helper to get or create controller
const getController = req => {
  const userId = req.userId;
  const session = req.userSession;
  const emitSSE = req.app.get('emitSSE');

  if (!activeControllers.has(userId)) {
    activeControllers.set(
      userId,
      new AutomationController(session, playwrightService, emitSSE, userId),
    );
  }

  return activeControllers.get(userId);
};

/**
 * POST /api/automation/start
 * Start the automation process
 */
router.post('/start', async (req, res) => {
  try {
    const controller = getController(req);
    const result = await controller.start();
    res.json(result);
  } catch (error) {
    console.error('Error starting automation:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/stop
 * Stop the automation process
 */
router.post('/stop', async (req, res) => {
  try {
    const controller = getController(req);
    const result = await controller.stop();
    res.json(result);
  } catch (error) {
    console.error('Error stopping automation:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/pause
 * Pause the automation process
 */
router.post('/pause', async (req, res) => {
  try {
    const controller = getController(req);
    const result = await controller.pause();
    res.json(result);
  } catch (error) {
    console.error('Error pausing automation:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/resume
 * Resume the automation process
 */
router.post('/resume', async (req, res) => {
  try {
    const controller = getController(req);
    const result = await controller.resume();
    res.json(result);
  } catch (error) {
    console.error('Error resuming automation:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/force-next
 * Skip current batch and move to next
 */
router.post('/force-next', async (req, res) => {
  try {
    const controller = getController(req);
    const result = await controller.forceNext();
    res.json(result);
  } catch (error) {
    console.error('Error forcing next batch:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/force-retry
 * Force retry immediately (skip countdown)
 */
router.post('/force-retry', async (req, res) => {
  try {
    const controller = getController(req);
    const result = await controller.forceRetry();
    res.json({
      success: true,
      message: `Force retry executed for batch ${result.batchNumber} with ${result.linkCount} links`,
      ...result,
    });
  } catch (error) {
    console.error('Error forcing retry:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/cancel-retry
 * Cancel retry and skip to next batch
 */
router.post('/cancel-retry', async (req, res) => {
  try {
    const controller = getController(req);
    const result = await controller.cancelRetry();
    res.json({
      success: true,
      message: `Retry canceled for batch ${result.batchNumber}. ${result.canceledCount} failed links archived.`,
      ...result,
    });
  } catch (error) {
    console.error('Error canceling retry:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/sync-sheets
 * Re-fetch links from Google Sheets
 */
router.post('/sync-sheets', async (req, res) => {
  try {
    const controller = getController(req);
    const newLinks = await controller.syncGoogleSheets();

    res.json({
      success: true,
      message: `Synced ${newLinks.length} new links`,
      newLinks: newLinks.length,
      totalLinks: req.userSession.allLinks.length,
    });
  } catch (error) {
    console.error('Error syncing sheets:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/automation/status
 * Get current automation status
 */
router.get('/status', (req, res) => {
  try {
    const controller = getController(req);
    const status = controller.getStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Error getting automation status:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/automation/update-settings
 * Update automation settings
 */
router.post('/update-settings', (req, res) => {
  try {
    const {
      batchSize,
      batchIntervalMinutes,
      aiProvider,
      additionalPrompt,
      googleSheetUrl,
      twitterCookies,
      twitterBearerToken,
      twitterUsername,
      twitterPassword,
      twitterVerificationHandle,
    } = req.body;

    if (batchSize !== undefined) {
      req.userSession.settings.batchSize = parseInt(batchSize);
      req.userSession.automation.batchSize = parseInt(batchSize);
    }

    if (batchIntervalMinutes !== undefined) {
      req.userSession.settings.batchIntervalMinutes = parseInt(batchIntervalMinutes);
      req.userSession.automation.intervalMinutes = parseInt(batchIntervalMinutes);
    }

    if (aiProvider) req.userSession.settings.aiProvider = aiProvider;
    if (additionalPrompt !== undefined)
      req.userSession.settings.additionalPrompt = additionalPrompt;
    if (googleSheetUrl) req.userSession.settings.googleSheetUrl = googleSheetUrl;
    if (twitterCookies !== undefined) req.userSession.settings.twitterCookies = twitterCookies;
    if (twitterBearerToken !== undefined)
      req.userSession.settings.twitterBearerToken = twitterBearerToken;
    if (twitterUsername !== undefined) req.userSession.settings.twitterUsername = twitterUsername;
    if (twitterPassword !== undefined) req.userSession.settings.twitterPassword = twitterPassword;
    if (twitterVerificationHandle !== undefined)
      req.userSession.settings.twitterVerificationHandle = twitterVerificationHandle;

    res.json({
      success: true,
      message: 'Settings updated',
      settings: req.userSession.settings,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
