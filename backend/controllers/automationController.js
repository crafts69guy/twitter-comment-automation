import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import { generateBulkComments } from '../services/aiService.js';
import { fetchTweetContentBatch } from '../helpers/twitterApi.js';

class AutomationController {
  constructor(session, playwrightService, emitSSE, userId) {
    this.session = session;
    this.playwright = playwrightService;
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

      // Step 2: Divide into batches (without content/comments)
      this.createBatches();

      // Step 3: Start processing first batch
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
   * Fetch tweet content for all links that don't have content
   */
  /**
   * Fetch tweet content for a specific batch of links that don't have content
   * This is REQUIRED - links without content will be skipped
   */
  async fetchTweetContentForBatch(batchLinks) {
    const linksWithoutContent = batchLinks.filter(
      link => !link.content || link.content.trim() === '',
    );

    if (linksWithoutContent.length === 0) {
      console.log('[AutomationController] All links in batch already have content');
      return;
    }

    console.log(
      `[AutomationController] Fetching tweet content for ${linksWithoutContent.length} links in batch...`,
    );

    const { twitterCookies, twitterBearerToken } = this.session.settings;

    // Check if Twitter API credentials are provided
    const hasTwitterApi = twitterCookies && twitterBearerToken;

    if (!hasTwitterApi) {
      const errorMsg =
        'Twitter API credentials are required to fetch tweet content. ' +
        'Please configure Twitter Cookies and Bearer Token in Settings.';
      console.error(`[AutomationController] ${errorMsg}`);

      // Emit error to frontend
      this.emitSSE(this.userId, 'error', {
        message: 'Twitter API credentials missing',
        details: errorMsg,
      });

      // Mark these links as having content error
      linksWithoutContent.forEach(link => {
        link.contentError = 'Twitter API credentials not configured';
      });

      return;
    }

    // Fetch content using Twitter API
    const contentResults = await fetchTweetContentBatch(
      linksWithoutContent,
      twitterCookies,
      twitterBearerToken,
    );

    // Update links with fetched content
    let successCount = 0;
    let failedCount = 0;

    contentResults.forEach(result => {
      const link = batchLinks.find(l => l.id === result.linkId);
      if (link) {
        if (result.success) {
          link.content = result.content;
          link.author = result.author;
          link.authorName = result.authorName;
          successCount++;
        } else {
          link.contentError = result.error;
          failedCount++;
          console.error(
            `[AutomationController] Failed to fetch content for ${link.url}: ${result.error}`,
          );
        }
      }
    });

    console.log(
      `[AutomationController] Fetched content for batch: ${successCount} success, ${failedCount} failed`,
    );

    this.emitSSE(this.userId, 'content:fetched', {
      successCount,
      failedCount,
      totalLinks: linksWithoutContent.length,
    });

    // If all failed, emit warning
    if (failedCount > 0 && successCount === 0) {
      this.emitSSE(this.userId, 'error', {
        message: 'Failed to fetch any tweet content for batch',
        details: 'Check your Twitter API credentials and try again',
      });
    }
  }

  /**
   * Generate AI comments for a specific batch of links that don't have them
   * ONLY generates comments for links that have valid content
   */
  async generateCommentsForBatch(batchLinks) {
    const linksWithoutComments = batchLinks.filter(link => !link.comment);

    if (linksWithoutComments.length === 0) {
      console.log('[AutomationController] All links in batch already have comments');
      return;
    }

    // Filter out links without content or with content errors
    const linksReadyForComments = linksWithoutComments.filter(
      link => link.content && link.content.trim() !== '' && !link.contentError,
    );

    const linksWithoutContent = linksWithoutComments.filter(
      link => !link.content || link.content.trim() === '' || link.contentError,
    );

    if (linksWithoutContent.length > 0) {
      console.warn(
        `[AutomationController] Skipping ${linksWithoutContent.length} links in batch without valid content`,
      );

      // Emit warning to frontend
      this.emitSSE(this.userId, 'warning', {
        message: `${linksWithoutContent.length} links skipped in batch - no content available`,
        details:
          'These links will not be processed. Configure Twitter API credentials to fetch tweet content.',
      });

      // Mark these links in the batch as failed
      linksWithoutContent.forEach(link => {
        link.skipReason = link.contentError || 'No content available - Twitter API not configured';
      });
    }

    if (linksReadyForComments.length === 0) {
      console.log(
        '[AutomationController] No links with valid content for comment generation in batch',
      );
      return;
    }

    console.log(
      `[AutomationController] Generating comments for ${linksReadyForComments.length} links in batch...`,
    );

    const { aiProvider, additionalPrompt } = this.session.settings;

    // Get API key from environment based on provider
    let apiKey;
    switch (aiProvider) {
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY;
        break;
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY;
        break;
      default:
        throw new Error(`Unknown AI provider: ${aiProvider}`);
    }

    if (!apiKey) {
      throw new Error(
        `API key not configured in .env for ${aiProvider}. Please add ${aiProvider.toUpperCase()}_API_KEY to your .env file`,
      );
    }

    // Use bulk generation for efficiency - only for links with valid content
    const posts = linksReadyForComments.map(link => ({
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
      const link = batchLinks.find(l => l.id === commentData.postId);
      if (link) {
        link.comment = commentData.comment;
      }
    });

    console.log(`[AutomationController] Generated ${comments.length} comments for batch`);

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

    // Create batches from all links (regardless of content/comments)
    for (let i = 0; i < this.session.allLinks.length; i += batchSize) {
      this.session.batches.push({
        batchId: uuidv4(),
        batchNumber: Math.floor(i / batchSize) + 1,
        links: this.session.allLinks.slice(i, i + batchSize),
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

    // Step 1: Fetch tweet content for this batch
    await this.fetchTweetContentForBatch(nextBatch.links);

    // Step 2: Generate AI comments for this batch
    await this.generateCommentsForBatch(nextBatch.links);

    // Filter out links that couldn't be processed (no content/comment)
    const linksToProcess = nextBatch.links.filter(link => link.comment && !link.skipReason);
    const skippedLinks = nextBatch.links.filter(link => !link.comment || link.skipReason);

    // Archive skipped links if any
    if (skippedLinks.length > 0) {
      console.log(
        `[AutomationController] Skipping ${skippedLinks.length} links without valid content/comment`,
      );
      skippedLinks.forEach(link => {
        this.session.failedLinks.push({
          linkId: link.id,
          url: link.url,
          comment: link.comment || '',
          content: link.content || '',
          batchNumber: nextBatch.batchNumber,
          error: link.skipReason || link.contentError || 'No content or comment available',
          failedAt: new Date(),
          canRetry: false,
        });
      });
    }

    // If no links to process, skip to next batch
    if (linksToProcess.length === 0) {
      console.log('[AutomationController] No valid links to process in batch, moving to next');
      nextBatch.status = 'completed';
      nextBatch.endTime = new Date();
      nextBatch.failedCount = skippedLinks.length;

      this.deleteBatchLinks(nextBatch);
      this.session.currentBatch = null;
      this.session.automation.totalBatchesCompleted++;

      this.emitSSE(this.userId, 'batch:completed', {
        batch: {
          batchId: nextBatch.batchId,
          batchNumber: nextBatch.batchNumber,
          status: nextBatch.status,
          successCount: 0,
          failedCount: nextBatch.failedCount,
        },
      });

      // Only schedule next batch if automation is still active
      if (this.session.automation.isActive) {
        this.scheduleNextBatch();
      }
      return;
    }

    // Step 3: Process batch with Playwright (only valid links)
    // Pass Twitter credentials for auto-login
    const credentials = {
      username: this.session.settings.twitterUsername,
      password: this.session.settings.twitterPassword,
    };

    const result = await this.playwright.processBatchSequential(
      linksToProcess,
      credentials,
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
      extractedCredentials => {
        // Credentials extracted callback
        if (extractedCredentials && extractedCredentials.bearerToken) {
          console.log('📥 Received extracted credentials from browser');

          // Update session settings with extracted credentials
          if (extractedCredentials.bearerToken) {
            this.session.settings.twitterBearerToken = extractedCredentials.bearerToken;
            console.log('✅ Updated Bearer Token in session');
          }

          if (extractedCredentials.cookies) {
            this.session.settings.twitterCookies = extractedCredentials.cookies;
            console.log('✅ Updated Cookies in session');
          }

          // Emit event to frontend to update UI and localStorage
          this.emitSSE(this.userId, 'credentials:extracted', {
            bearerToken: extractedCredentials.bearerToken || '',
            cookies: extractedCredentials.cookies || '',
            message: 'Bearer Token and Cookies extracted from browser successfully!',
          });
        }
      },
    );

    // Check if automation was stopped during processing
    if (!this.session.automation.isActive || result.stopped) {
      console.log('[AutomationController] Batch stopped or automation inactive');
      nextBatch.status = 'stopped';
      nextBatch.endTime = new Date();
      nextBatch.results = result.results;
      this.updateBatchStats(nextBatch);
      this.archiveFailedLinks(nextBatch);
      this.deleteBatchLinks(nextBatch);
      this.session.currentBatch = null;
      return; // Exit immediately without scheduling next batch
    }

    // Update batch status
    nextBatch.status = 'completed';
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

    // Only schedule next batch if automation is still active
    if (this.session.automation.isActive) {
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
    // Double check automation is still active before scheduling
    if (!this.session.automation.isActive) {
      console.log('[AutomationController] Automation not active, skipping schedule');
      return;
    }

    const intervalMs = (this.session.settings.batchIntervalMinutes || 20) * 60 * 1000;
    const nextRunTime = new Date(Date.now() + intervalMs);

    this.session.automation.nextBatchTime = nextRunTime;

    console.log(`[AutomationController] Next batch scheduled for ${nextRunTime}`);

    this.emitSSE(this.userId, 'batch:scheduled', {
      nextBatchTime: nextRunTime,
      intervalMinutes: this.session.settings.batchIntervalMinutes,
    });

    // Clear any existing countdown interval first
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // Countdown timer
    this.countdownInterval = setInterval(() => {
      // Check if automation is still active during countdown
      if (!this.session.automation.isActive) {
        console.log('[AutomationController] Automation stopped during countdown');
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
        return;
      }

      const remaining = nextRunTime - Date.now();

      if (remaining <= 0) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
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
    this.playwright.setPause(true);

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
    this.playwright.setPause(false);

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

    // Set flags first to prevent any new batches from starting
    this.session.automation.isActive = false;
    this.session.automation.isPaused = false;
    this.playwright.setStop(true);

    // Clear countdown interval to prevent next batch from scheduling
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Clear next batch time
    this.session.automation.nextBatchTime = null;

    // If there's a current batch, mark it as stopped
    if (this.session.currentBatch) {
      const currentBatch = this.getCurrentBatch();
      if (currentBatch) {
        currentBatch.status = 'stopped';
        currentBatch.endTime = new Date();
      }
    }

    this.emitSSE(this.userId, 'automation:stopped', {});

    // Wait a bit for current processing to stop, then reset flag
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.playwright.setStop(false);

    console.log('[AutomationController] Automation stopped successfully');

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
      this.playwright.setStop(true);

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
      this.playwright.setStop(false);

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
