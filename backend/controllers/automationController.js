import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import { generateBulkComments } from '../services/aiService.js';

class AutomationController {
  constructor(session, puppeteerService, emitSSE, userId) {
    this.session = session;
    this.puppeteer = puppeteerService;
    this.emitSSE = emitSSE;
    this.userId = userId;
    this.countdownInterval = null;
  }

  /**
   * Start automation process
   */
  async start() {
    console.log(`[AutomationController] Starting automation for user ${this.userId}`);

    try {
      // Step 1: Fetch from Google Sheets if no links exist
      if (this.session.allLinks.length === 0) {
        console.log('[AutomationController] Fetching from Google Sheets...');
        await this.syncGoogleSheets();
      }

      // Step 2: Generate AI comments for links that don't have them
      await this.generateCommentsForAll();

      // Step 3: Divide into batches
      this.createBatches();

      // Step 4: Start processing first batch
      this.session.automation.isActive = true;
      this.emitSSE(this.userId, 'automation:started', {
        totalBatches: this.session.batches.length,
        totalLinks: this.session.allLinks.length,
      });

      await this.processNextBatch();

      return {
        success: true,
        message: 'Automation started',
        totalBatches: this.session.batches.length,
        totalLinks: this.session.allLinks.length,
      };
    } catch (error) {
      console.error('[AutomationController] Error starting automation:', error);
      this.session.automation.isActive = false;
      throw error;
    }
  }

  /**
   * Sync Google Sheets to fetch new links
   */
  async syncGoogleSheets() {
    const { googleSheetUrl } = this.session.settings;

    if (!googleSheetUrl) {
      throw new Error('Google Sheet URL not configured');
    }

    // Extract sheet ID from URL
    const sheetIdMatch = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      throw new Error('Invalid Google Sheets URL');
    }

    const spreadsheetId = sheetIdMatch[1];

    // Get credentials path from environment
    const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './google-credentials.json';

    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch data from columns A and B
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:B',
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      throw new Error('No data found in spreadsheet');
    }

    // Skip header row and filter for Twitter/X URLs
    const newLinks = rows
      .slice(1)
      .filter(row => {
        const url = row[0];
        return url && (url.includes('twitter.com') || url.includes('x.com'));
      })
      .map((row, index) => ({
        id: uuidv4(),
        url: row[0],
        content: row[1] || '', // Pre-filled content from column B
        comment: null,
        originalIndex: index,
      }));

    // Add to allLinks (avoid duplicates by URL)
    const existingUrls = new Set(this.session.allLinks.map(l => l.url));
    const uniqueNewLinks = newLinks.filter(link => !existingUrls.has(link.url));

    this.session.allLinks.push(...uniqueNewLinks);

    console.log(
      `[AutomationController] Synced ${uniqueNewLinks.length} new links from Google Sheets`,
    );

    this.emitSSE(this.userId, 'sheets:synced', {
      newLinks: uniqueNewLinks.length,
      totalLinks: this.session.allLinks.length,
    });

    return uniqueNewLinks;
  }

  /**
   * Generate AI comments for all links that don't have them
   */
  async generateCommentsForAll() {
    const linksWithoutComments = this.session.allLinks.filter(link => !link.comment);

    if (linksWithoutComments.length === 0) {
      console.log('[AutomationController] All links already have comments');
      return;
    }

    console.log(
      `[AutomationController] Generating comments for ${linksWithoutComments.length} links...`,
    );

    const { aiProvider, apiKey, additionalPrompt } = this.session.settings;

    if (!apiKey) {
      throw new Error(`API key not configured for ${aiProvider}`);
    }

    // Use bulk generation for efficiency
    const posts = linksWithoutComments.map(link => ({
      id: link.id,
      content: link.content,
    }));

    const comments = await generateBulkComments(
      posts,
      aiProvider,
      apiKey,
      280, // Twitter character limit
      additionalPrompt,
    );

    // Update links with generated comments
    comments.forEach(commentData => {
      const link = this.session.allLinks.find(l => l.id === commentData.postId);
      if (link) {
        link.comment = commentData.comment;
      }
    });

    console.log(`[AutomationController] Generated ${comments.length} comments`);

    this.emitSSE(this.userId, 'comments:generated', {
      count: comments.length,
    });
  }

  /**
   * Create batches from allLinks
   */
  createBatches() {
    const batchSize = this.session.settings.batchSize || 15;
    this.session.batches = [];

    const linksToProcess = this.session.allLinks.filter(link => link.comment);

    for (let i = 0; i < linksToProcess.length; i += batchSize) {
      this.session.batches.push({
        batchId: uuidv4(),
        batchNumber: Math.floor(i / batchSize) + 1,
        links: linksToProcess.slice(i, i + batchSize),
        status: 'pending',
        successCount: 0,
        failedCount: 0,
        results: [],
        startTime: null,
        endTime: null,
      });
    }

    console.log(`[AutomationController] Created ${this.session.batches.length} batches`);
  }

  /**
   * Process next pending batch
   */
  async processNextBatch() {
    if (!this.session.automation.isActive) {
      console.log('[AutomationController] Automation not active, stopping...');
      return;
    }

    const nextBatch = this.getNextPendingBatch();

    if (!nextBatch) {
      console.log('[AutomationController] No more batches to process');
      this.session.automation.isActive = false;
      this.emitSSE(this.userId, 'automation:completed', {
        totalBatches: this.session.batches.length,
        stats: {
          totalProcessed: this.session.automation.totalLinksProcessed,
          totalSuccessful: this.session.automation.totalSuccessful,
          totalFailed: this.session.automation.totalFailed,
        },
      });
      return;
    }

    // Update current batch
    this.session.currentBatch = {
      batchId: nextBatch.batchId,
      batchNumber: nextBatch.batchNumber,
      currentLinkIndex: 0,
      status: 'processing',
      startedAt: new Date(),
    };

    nextBatch.status = 'processing';
    nextBatch.startTime = new Date();

    console.log(
      `[AutomationController] Starting batch ${nextBatch.batchNumber}/${this.session.batches.length}`,
    );

    this.emitSSE(this.userId, 'batch:started', {
      batch: {
        batchId: nextBatch.batchId,
        batchNumber: nextBatch.batchNumber,
        totalLinks: nextBatch.links.length,
      },
    });

    // Process batch with callbacks
    const result = await this.puppeteer.processBatchSequential(
      nextBatch.links,
      progress => {
        // Progress callback
        this.session.currentBatch.currentLinkIndex = progress.currentIndex;
        this.emitSSE(this.userId, 'link:processing', {
          ...progress,
          batchNumber: nextBatch.batchNumber,
        });
      },
      linkResult => {
        // Link complete callback
        this.handleLinkResult(nextBatch, linkResult);
      },
    );

    // Update batch status
    nextBatch.status = result.stopped ? 'stopped' : 'completed';
    nextBatch.endTime = new Date();
    nextBatch.results = result.results;

    // Calculate stats
    this.updateBatchStats(nextBatch);

    // Clear current batch
    this.session.currentBatch = null;

    this.emitSSE(this.userId, 'batch:completed', {
      batch: {
        batchId: nextBatch.batchId,
        batchNumber: nextBatch.batchNumber,
        status: nextBatch.status,
        successCount: nextBatch.successCount,
        failedCount: nextBatch.failedCount,
      },
    });

    // Archive failed links
    this.archiveFailedLinks(nextBatch);

    // Delete batch links from allLinks (cleanup)
    this.deleteBatchLinks(nextBatch);

    // Update automation stats
    this.session.automation.totalBatchesCompleted++;

    if (!result.stopped) {
      // Schedule next batch
      this.scheduleNextBatch();
    }
  }

  /**
   * Handle individual link result
   */
  handleLinkResult(batch, result) {
    if (result.status === 'success') {
      batch.successCount = (batch.successCount || 0) + 1;
      this.session.automation.totalSuccessful++;
      this.emitSSE(this.userId, 'link:success', {
        linkId: result.linkId,
        batchNumber: batch.batchNumber,
      });
    } else {
      batch.failedCount = (batch.failedCount || 0) + 1;
      this.session.automation.totalFailed++;
      this.emitSSE(this.userId, 'link:failed', {
        linkId: result.linkId,
        error: result.error,
        batchNumber: batch.batchNumber,
      });
    }
    this.session.automation.totalLinksProcessed++;
  }

  /**
   * Update batch statistics
   */
  updateBatchStats(batch) {
    batch.successCount = batch.results.filter(r => r.status === 'success').length;
    batch.failedCount = batch.results.filter(r => r.status === 'failed').length;
  }

  /**
   * Archive failed links to history
   */
  archiveFailedLinks(batch) {
    const failedResults = batch.results.filter(r => r.status === 'failed');

    failedResults.forEach(result => {
      const link = batch.links.find(l => l.id === result.linkId);
      if (link) {
        this.session.failedLinks.push({
          linkId: link.id,
          url: link.url,
          comment: link.comment,
          content: link.content,
          batchNumber: batch.batchNumber,
          error: result.error,
          failedAt: result.processedAt,
          canRetry: true,
        });
      }
    });

    console.log(`[AutomationController] Archived ${failedResults.length} failed links`);
  }

  /**
   * Delete batch links from allLinks
   */
  deleteBatchLinks(batch) {
    const linkIds = batch.links.map(l => l.id);
    this.session.allLinks = this.session.allLinks.filter(link => !linkIds.includes(link.id));

    console.log(`[AutomationController] Deleted ${linkIds.length} processed links from allLinks`);
  }

  /**
   * Schedule next batch
   */
  scheduleNextBatch() {
    const intervalMs = (this.session.settings.batchIntervalMinutes || 20) * 60 * 1000;
    const nextRunTime = new Date(Date.now() + intervalMs);

    this.session.automation.nextBatchTime = nextRunTime;

    console.log(`[AutomationController] Next batch scheduled for ${nextRunTime}`);

    this.emitSSE(this.userId, 'batch:scheduled', {
      nextBatchTime: nextRunTime,
      intervalMinutes: this.session.settings.batchIntervalMinutes,
    });

    // Countdown timer
    this.countdownInterval = setInterval(() => {
      const remaining = nextRunTime - Date.now();

      if (remaining <= 0) {
        clearInterval(this.countdownInterval);
        this.processNextBatch();
      } else {
        this.emitSSE(this.userId, 'countdown:update', {
          remainingMs: remaining,
          nextBatchTime: nextRunTime,
        });
      }
    }, 1000);
  }

  /**
   * Pause automation
   */
  async pause() {
    console.log('[AutomationController] Pausing automation...');
    this.session.automation.isPaused = true;
    this.puppeteer.setPause(true);

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.emitSSE(this.userId, 'automation:paused', {
      currentBatch: this.session.currentBatch,
    });

    return {
      success: true,
      message: 'Automation paused',
    };
  }

  /**
   * Resume automation
   */
  async resume() {
    console.log('[AutomationController] Resuming automation...');
    this.session.automation.isPaused = false;
    this.puppeteer.setPause(false);

    this.emitSSE(this.userId, 'automation:resumed', {
      currentBatch: this.session.currentBatch,
    });

    return {
      success: true,
      message: 'Automation resumed',
    };
  }

  /**
   * Stop automation
   */
  async stop() {
    console.log('[AutomationController] Stopping automation...');
    this.session.automation.isActive = false;
    this.session.automation.isPaused = false;
    this.puppeteer.setStop(true);

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.emitSSE(this.userId, 'automation:stopped', {});

    // Reset stop flag after a delay
    setTimeout(() => {
      this.puppeteer.setStop(false);
    }, 1000);

    return {
      success: true,
      message: 'Automation stopped',
    };
  }

  /**
   * Force skip to next batch
   */
  async forceNext() {
    console.log('[AutomationController] Forcing next batch...');

    const currentBatch = this.getCurrentBatch();

    if (currentBatch && this.session.currentBatch) {
      // Get remaining unprocessed links
      const currentIndex = this.session.currentBatch.currentLinkIndex || 0;
      const skippedLinks = currentBatch.links.slice(currentIndex);

      console.log(`[AutomationController] Skipping ${skippedLinks.length} remaining links`);

      // Archive skipped links as failed
      skippedLinks.forEach(link => {
        this.session.failedLinks.push({
          linkId: link.id,
          url: link.url,
          comment: link.comment,
          content: link.content,
          batchNumber: currentBatch.batchNumber,
          error: 'Skipped by Force Next',
          failedAt: new Date(),
          canRetry: true,
        });
      });

      // Stop current processing
      this.puppeteer.setStop(true);

      // Wait a bit for processing to stop
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mark current batch as stopped
      currentBatch.status = 'stopped';
      currentBatch.endTime = new Date();

      // Delete current batch links
      this.deleteBatchLinks(currentBatch);

      // Clear current batch
      this.session.currentBatch = null;

      // Reset stop flag
      this.puppeteer.setStop(false);

      this.emitSSE(this.userId, 'batch:skipped', {
        batchNumber: currentBatch.batchNumber,
        skippedLinks: skippedLinks.length,
      });

      // Process next batch immediately
      await this.processNextBatch();

      return {
        success: true,
        message: 'Skipped to next batch',
        skippedLinks: skippedLinks.length,
      };
    }

    return {
      success: false,
      message: 'No active batch to skip',
    };
  }

  /**
   * Get next pending batch
   */
  getNextPendingBatch() {
    return this.session.batches.find(b => b.status === 'pending');
  }

  /**
   * Get current batch
   */
  getCurrentBatch() {
    if (!this.session.currentBatch) return null;
    return this.session.batches.find(b => b.batchId === this.session.currentBatch.batchId);
  }

  /**
   * Get automation status
   */
  getStatus() {
    return {
      isActive: this.session.automation.isActive,
      isPaused: this.session.automation.isPaused,
      currentBatch: this.session.currentBatch,
      nextBatchTime: this.session.automation.nextBatchTime,
      stats: {
        totalBatchesCompleted: this.session.automation.totalBatchesCompleted,
        totalLinksProcessed: this.session.automation.totalLinksProcessed,
        totalSuccessful: this.session.automation.totalSuccessful,
        totalFailed: this.session.automation.totalFailed,
        totalBatches: this.session.batches.length,
        pendingBatches: this.session.batches.filter(b => b.status === 'pending').length,
      },
    };
  }
}

export default AutomationController;
