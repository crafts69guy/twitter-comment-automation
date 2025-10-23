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
    this.retryTimers = new Map(); // Track retry timers for each batch
    this.retryCountdownIntervals = new Map(); // Track countdown intervals
  }

  /**
   * Start automation process
   */
  async start() {
    console.log(`[AutomationController] Starting automation for user ${this.userId}`);

    try {
      // VALIDATION STEP 1: Check if browser is open
      const browserStatus = await this.playwright.getBrowserStatus();

      if (!browserStatus.isOpen) {
        const errorMsg = 'Browser is not open. Please open the browser first.';
        console.error(`[AutomationController] ${errorMsg}`);
        this.emitSSE(this.userId, 'error', {
          message: 'Browser Not Open',
          details: errorMsg,
        });
        throw new Error(errorMsg);
      }

      console.log('[AutomationController] ✓ Browser is open');

      // VALIDATION STEP 2: Check if logged in to Twitter
      if (!browserStatus.isLoggedIn) {
        const errorMsg =
          'Not logged in to Twitter. Please login manually in the browser before starting automation.';
        console.error(`[AutomationController] ${errorMsg}`);
        this.emitSSE(this.userId, 'error', {
          message: 'Twitter Login Required',
          details: errorMsg,
        });
        throw new Error(errorMsg);
      }

      console.log('[AutomationController] ✓ Logged in to Twitter');

      // VALIDATION STEP 3: Check if links exist
      if (this.session.allLinks.length === 0) {
        console.log('[AutomationController] No links found, fetching from Google Sheets...');
        await this.syncGoogleSheets();

        // Double-check after sync
        if (this.session.allLinks.length === 0) {
          const errorMsg =
            'No links found in Google Sheets. Please add Twitter URLs to your sheet and sync again.';
          console.error(`[AutomationController] ${errorMsg}`);
          this.emitSSE(this.userId, 'error', {
            message: 'No Links Found',
            details: errorMsg,
          });
          throw new Error(errorMsg);
        }
      }

      console.log(
        `[AutomationController] ✓ Found ${this.session.allLinks.length} links to process`,
      );

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
    // LAYER 1: Backend Protection - Prevent sync during active batch processing
    // Allow sync when:
    // 1. Automation is completely stopped (isActive=false)
    // 2. Automation is paused (isActive=true && isPaused=true) AND no batch is currently being processed
    const isProcessing =
      this.session.automation.isActive &&
      !this.session.automation.isPaused &&
      this.session.currentBatch;

    if (isProcessing) {
      throw new Error(
        'Cannot sync sheets while batch is processing. Please pause or stop automation first.',
      );
    }

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

    // Recreate batches to include new links
    // This is safe to do even when paused - it won't affect current processing
    if (uniqueNewLinks.length > 0) {
      const currentBatchId = this.session.currentBatch?.batchId;
      const currentBatchIndex = this.session.currentBatch?.currentLinkIndex || 0;

      // Save processed batches before recreating
      const processedBatches = this.session.batches.filter(
        b => b.status === 'completed' || b.status === 'stopped',
      );

      // Save current processing batch if exists
      let currentProcessingBatch = null;
      if (currentBatchId) {
        currentProcessingBatch = this.session.batches.find(b => b.batchId === currentBatchId);
      }

      // Recreate all batches with new links included
      this.createBatches();

      // Restore processed batches status (mark them as completed/stopped)
      processedBatches.forEach(oldBatch => {
        const newBatch = this.session.batches.find(b => b.links[0]?.url === oldBatch.links[0]?.url);
        if (newBatch) {
          newBatch.status = oldBatch.status;
          newBatch.successCount = oldBatch.successCount;
          newBatch.failedCount = oldBatch.failedCount;
          newBatch.results = oldBatch.results;
          newBatch.startTime = oldBatch.startTime;
          newBatch.endTime = oldBatch.endTime;
        }
      });

      // Restore current batch reference if it was processing
      if (currentProcessingBatch) {
        const newCurrentBatch = this.session.batches.find(
          b => b.links[0]?.url === currentProcessingBatch.links[0]?.url,
        );
        if (newCurrentBatch) {
          // Update currentBatch reference to new batch
          this.session.currentBatch = {
            batchId: newCurrentBatch.batchId,
            currentLinkIndex: currentBatchIndex,
          };

          // Mark as processing
          newCurrentBatch.status = 'processing';
          newCurrentBatch.startTime = currentProcessingBatch.startTime;

          // Restore any existing results
          if (currentProcessingBatch.results) {
            newCurrentBatch.results = currentProcessingBatch.results;
            newCurrentBatch.successCount = currentProcessingBatch.successCount;
            newCurrentBatch.failedCount = currentProcessingBatch.failedCount;
          }

          console.log(
            `[AutomationController] Restored current batch reference: ${newCurrentBatch.batchId}`,
          );
        }
      }

      console.log(
        `[AutomationController] Recreated ${this.session.batches.length} batches with new links`,
      );
    }

    this.emitSSE(this.userId, 'sheets:synced', {
      newLinks: uniqueNewLinks.length,
      totalLinks: this.session.allLinks.length,
      totalBatches: this.session.batches.length,
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
    let hasExpiredCreds = false;

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

          // ✅ CHECK IF CREDENTIALS EXPIRED
          if (result.needsReauth) {
            hasExpiredCreds = true;
          }

          console.error(
            `[AutomationController] Failed to fetch content for ${link.url}: ${result.error}`,
          );
        }
      }
    });

    // ✅ HANDLE EXPIRED CREDENTIALS
    if (hasExpiredCreds) {
      console.error('❌ Twitter API credentials expired');

      // Emit warning to user
      this.emitSSE(this.userId, 'error', {
        message: 'Twitter API credentials expired',
        details:
          'Please update Bearer Token and Cookies in Settings tab. You can extract them from Twitter DevTools (Network tab → Request Headers).',
      });

      // Stop automation if credentials expired
      this.session.automation.isActive = false;
      this.session.automation.isPaused = false;

      throw new Error(
        'Twitter API credentials expired. Please update Bearer Token and Cookies in Settings.',
      );
    }

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
      80, // Twitter character limit
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
      currentLinkStatus: null, // Track detailed status of current link
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
    this.updateCurrentLinkStatus('fetching_content', 'Fetching tweet content...', '1/4');
    await this.fetchTweetContentForBatch(nextBatch.links);

    // Step 2: Generate AI comments for this batch
    this.updateCurrentLinkStatus('generating_comments', 'Generating AI comments...', '2/4');
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
    const result = await this.playwright.processBatchSequential(
      linksToProcess,
      progress => {
        // Progress callback
        this.session.currentBatch.currentLinkIndex = progress.currentIndex;

        // Update status when starting to process a new link
        this.updateCurrentLinkStatus(
          'processing',
          `Processing link ${progress.currentIndex + 1}/${progress.total}`,
          '3/4',
        );

        this.emitSSE(this.userId, 'link:processing', {
          ...progress,
          batchNumber: nextBatch.batchNumber,
        });
      },
      linkResult => {
        // Link complete callback
        this.handleLinkResult(nextBatch, linkResult);

        // Update status after completing link
        if (linkResult.status === 'success') {
          this.updateCurrentLinkStatus('completed', 'Link processed successfully', '4/4');
        } else {
          this.updateCurrentLinkStatus('failed', `Failed: ${linkResult.error}`, '4/4');
        }
      },
      (status, message, step) => {
        // Status update callback from playwrightService
        this.updateCurrentLinkStatus(status, message, step);
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

    // ✅ CHECK IF RETRY IS NEEDED BEFORE ARCHIVING FAILED LINKS
    const shouldRetry = await this.checkAndScheduleRetry(nextBatch);

    if (!shouldRetry) {
      // No retry needed - archive failed links permanently
      this.archiveFailedLinks(nextBatch);
    }

    // Delete batch links from allLinks (cleanup)
    this.deleteBatchLinks(nextBatch);

    // Update automation stats
    this.session.automation.totalBatchesCompleted++;

    // Only schedule next batch if automation is still active AND no retry pending
    if (this.session.automation.isActive && !this.session.automation.retryPending) {
      this.scheduleNextBatch();
    }
  }

  /**
   * Handle individual link result
   */
  handleLinkResult(batch, result) {
    // Find the link object to get the URL
    const link = batch.links.find(l => l.id === result.linkId);

    if (result.status === 'success') {
      batch.successCount = (batch.successCount || 0) + 1;
      this.session.automation.totalSuccessful++;
      this.emitSSE(this.userId, 'link:success', {
        linkId: result.linkId,
        url: link?.url || 'Unknown',
        batchNumber: batch.batchNumber,
      });
    } else {
      batch.failedCount = (batch.failedCount || 0) + 1;
      this.session.automation.totalFailed++;
      this.emitSSE(this.userId, 'link:failed', {
        linkId: result.linkId,
        url: link?.url || 'Unknown',
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
   * Check if batch needs retry and schedule it
   * Returns true if retry is scheduled, false otherwise
   */
  async checkAndScheduleRetry(batch) {
    // Check if batch has already been retried
    if (batch.retryCount && batch.retryCount >= 1) {
      console.log(
        `[AutomationController] Batch ${batch.batchNumber} already retried, no more retries`,
      );
      return false;
    }

    const totalLinks = batch.links.length;
    const failedCount = batch.failedCount;
    const failureRate = failedCount / totalLinks;

    // No failed links - no retry needed
    if (failedCount === 0) {
      console.log(`[AutomationController] Batch ${batch.batchNumber} has no failures`);
      return false;
    }

    // All links failed (100%) - might be a critical issue, no retry
    if (failureRate >= 1) {
      console.log(
        `[AutomationController] Batch ${batch.batchNumber} has 100% failure rate - no retry`,
      );
      return false;
    }

    // Filter out non-retryable failures (links without content)
    const retryableFailures = batch.results.filter(result => {
      if (result.status !== 'failed') return false;

      const link = batch.links.find(l => l.id === result.linkId);
      if (!link) return false;

      // Exclude links without content (critical error)
      if (!link.content || link.content.trim() === '' || link.contentError) {
        console.log(`[AutomationController] Link ${link.id} excluded from retry - no content`);
        return false;
      }

      return true;
    });

    if (retryableFailures.length === 0) {
      console.log(`[AutomationController] Batch ${batch.batchNumber} has no retryable failures`);
      return false;
    }

    // Determine retry delay based on failure rate
    const failureThreshold = (this.session.settings.retryFailureThreshold || 30) / 100;
    const retryDelayMinutes =
      failureRate < failureThreshold
        ? this.session.settings.retryDelayLow || 5
        : this.session.settings.retryDelayHigh || 10;

    console.log(
      `[AutomationController] Scheduling retry for batch ${batch.batchNumber}: ${retryableFailures.length} links, delay ${retryDelayMinutes}min, failure rate ${(failureRate * 100).toFixed(1)}%`,
    );

    // Schedule retry
    this.scheduleRetry(batch, retryableFailures, retryDelayMinutes);

    return true;
  }

  /**
   * Schedule retry for failed links
   */
  scheduleRetry(batch, retryableFailures, delayMinutes) {
    const retryTime = new Date(Date.now() + delayMinutes * 60 * 1000);

    // Mark batch as having retry scheduled
    batch.retryScheduled = {
      retryAt: retryTime,
      retryCount: (batch.retryCount || 0) + 1,
      maxRetries: 1,
      failedLinksToRetry: retryableFailures.map(r => r.linkId),
    };

    // Set global retry pending flag to pause new batches
    this.session.automation.retryPending = true;
    this.session.automation.retryBatchNumber = batch.batchNumber;

    // Emit event to frontend
    this.emitSSE(this.userId, 'batch:retry_scheduled', {
      batchNumber: batch.batchNumber,
      retryAt: retryTime,
      failedCount: retryableFailures.length,
      delayMinutes,
      failureRate: ((retryableFailures.length / batch.links.length) * 100).toFixed(1),
    });

    console.log(
      `[AutomationController] Retry scheduled for batch ${batch.batchNumber} at ${retryTime}`,
    );

    // Start countdown timer
    this.startRetryCountdown(batch, retryTime, delayMinutes);

    // Schedule retry execution
    const timerId = setTimeout(
      () => {
        this.retryBatch(batch, retryableFailures);
      },
      delayMinutes * 60 * 1000,
    );

    this.retryTimers.set(batch.batchId, timerId);
  }

  /**
   * Start countdown timer for retry
   */
  startRetryCountdown(batch, retryTime, delayMinutes) {
    // Clear any existing countdown for this batch
    if (this.retryCountdownIntervals.has(batch.batchId)) {
      clearInterval(this.retryCountdownIntervals.get(batch.batchId));
    }

    // Emit initial countdown
    this.emitSSE(this.userId, 'retry:countdown', {
      batchNumber: batch.batchNumber,
      remainingMs: retryTime - Date.now(),
      retryAt: retryTime,
      delayMinutes,
    });

    // Update countdown every second
    const countdownInterval = setInterval(() => {
      const remaining = retryTime - Date.now();

      if (remaining <= 0) {
        clearInterval(countdownInterval);
        this.retryCountdownIntervals.delete(batch.batchId);
        return;
      }

      this.emitSSE(this.userId, 'retry:countdown', {
        batchNumber: batch.batchNumber,
        remainingMs: remaining,
        retryAt: retryTime,
        delayMinutes,
      });
    }, 1000); // Update every second for smooth countdown

    this.retryCountdownIntervals.set(batch.batchId, countdownInterval);
  }

  /**
   * Retry batch with failed links
   */
  async retryBatch(batch, retryableFailures) {
    console.log(
      `[AutomationController] Starting retry for batch ${batch.batchNumber} with ${retryableFailures.length} links`,
    );

    // Clear timers
    this.retryTimers.delete(batch.batchId);
    if (this.retryCountdownIntervals.has(batch.batchId)) {
      clearInterval(this.retryCountdownIntervals.get(batch.batchId));
      this.retryCountdownIntervals.delete(batch.batchId);
    }

    // Check if automation is still active
    if (!this.session.automation.isActive) {
      console.log('[AutomationController] Automation not active, skipping retry');
      this.session.automation.retryPending = false;
      return;
    }

    // Emit retry started event
    this.emitSSE(this.userId, 'batch:retry_started', {
      batchNumber: batch.batchNumber,
      retryCount: retryableFailures.length,
    });

    // Get links to retry
    const linksToRetry = retryableFailures
      .map(result => batch.links.find(l => l.id === result.linkId))
      .filter(link => link !== undefined);

    // Increment retry count
    batch.retryCount = (batch.retryCount || 0) + 1;

    // Set current batch for retry
    this.session.currentBatch = {
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      currentLinkIndex: 0,
      status: 'retrying',
      startedAt: new Date(),
      currentLinkStatus: null,
      isRetry: true,
    };

    // Process retry links
    const result = await this.playwright.processBatchSequential(
      linksToRetry,
      progress => {
        this.session.currentBatch.currentLinkIndex = progress.currentIndex;
        this.updateCurrentLinkStatus(
          'processing',
          `Retrying link ${progress.currentIndex + 1}/${progress.total}`,
          '3/4',
        );
        this.emitSSE(this.userId, 'link:processing', {
          ...progress,
          batchNumber: batch.batchNumber,
          isRetry: true,
        });
      },
      linkResult => {
        this.handleRetryLinkResult(batch, linkResult);

        if (linkResult.status === 'success') {
          this.updateCurrentLinkStatus('completed', 'Retry succeeded', '4/4');
        } else {
          this.updateCurrentLinkStatus('failed', `Retry failed: ${linkResult.error}`, '4/4');
        }
      },
      (status, message, step) => {
        this.updateCurrentLinkStatus(status, message, step);
      },
    );

    // Clear current batch
    this.session.currentBatch = null;

    // Calculate retry stats
    const retrySuccessCount = result.results.filter(r => r.status === 'success').length;
    const retryFailedCount = result.results.filter(r => r.status === 'failed').length;

    console.log(
      `[AutomationController] Retry completed: ${retrySuccessCount} success, ${retryFailedCount} failed`,
    );

    // Emit retry completed event
    this.emitSSE(this.userId, 'batch:retry_completed', {
      batchNumber: batch.batchNumber,
      successCount: retrySuccessCount,
      failedCount: retryFailedCount,
      totalRetried: result.results.length,
    });

    // Archive links that still failed after retry
    this.archiveRetryFailures(batch, result.results);

    // Clear retry pending flag
    this.session.automation.retryPending = false;
    this.session.automation.retryBatchNumber = null;

    // Resume normal batch processing if automation is still active
    if (this.session.automation.isActive) {
      console.log('[AutomationController] Resuming normal batch processing after retry');
      this.scheduleNextBatch();
    }
  }

  /**
   * Handle individual retry link result
   */
  handleRetryLinkResult(batch, result) {
    // Find the link object to get the URL
    const link = batch.links.find(l => l.id === result.linkId);

    if (result.status === 'success') {
      this.session.automation.totalSuccessful++;
      this.emitSSE(this.userId, 'link:retry_success', {
        linkId: result.linkId,
        url: link?.url || 'Unknown',
        batchNumber: batch.batchNumber,
      });
    } else {
      this.session.automation.totalFailed++;
      this.emitSSE(this.userId, 'link:retry_failed', {
        linkId: result.linkId,
        url: link?.url || 'Unknown',
        error: result.error,
        batchNumber: batch.batchNumber,
      });
    }
  }

  /**
   * Archive links that still failed after retry
   */
  archiveRetryFailures(batch, retryResults) {
    const stillFailedResults = retryResults.filter(r => r.status === 'failed');

    stillFailedResults.forEach(result => {
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
          canRetry: false, // No more retries
          retriedAt: new Date(),
        });
      }
    });

    console.log(
      `[AutomationController] Archived ${stillFailedResults.length} links that failed after retry`,
    );
  }

  /**
   * Force retry immediately (skip countdown)
   */
  async forceRetry() {
    // Check if there's a retry pending
    if (!this.session.automation.retryPending) {
      throw new Error('No retry scheduled');
    }

    const batchNumber = this.session.automation.retryBatchNumber;
    console.log(`[AutomationController] Force retry requested for batch ${batchNumber}`);

    // Find the batch with retry scheduled (search in all batches)
    const batch = this.session.batches.find(b => b.batchNumber === batchNumber && b.retryScheduled);

    if (!batch) {
      throw new Error(`Batch ${batchNumber} not found or no retry scheduled`);
    }

    // Get the retryable failures from batch.retryScheduled
    const retryableFailures = batch.results.filter(
      result =>
        result.status === 'failed' &&
        batch.retryScheduled.failedLinksToRetry.includes(result.linkId),
    );

    if (retryableFailures.length === 0) {
      throw new Error('No retryable failures found');
    }

    // Clear timers and countdowns
    if (this.retryTimers.has(batch.batchId)) {
      clearTimeout(this.retryTimers.get(batch.batchId));
      this.retryTimers.delete(batch.batchId);
      console.log(`[AutomationController] Cleared retry timer for batch ${batch.batchId}`);
    }

    if (this.retryCountdownIntervals.has(batch.batchId)) {
      clearInterval(this.retryCountdownIntervals.get(batch.batchId));
      this.retryCountdownIntervals.delete(batch.batchId);
      console.log(`[AutomationController] Cleared countdown for batch ${batch.batchId}`);
    }

    // Emit force retry event
    this.emitSSE(this.userId, 'batch:force_retry', {
      batchNumber: batch.batchNumber,
      linkCount: retryableFailures.length,
    });

    // Execute retry immediately
    console.log(
      `[AutomationController] Force executing retry for batch ${batch.batchNumber} with ${retryableFailures.length} links`,
    );
    await this.retryBatch(batch, retryableFailures);

    return {
      success: true,
      batchNumber: batch.batchNumber,
      linkCount: retryableFailures.length,
    };
  }

  /**
   * Cancel retry (skip failed links and continue to next batch)
   */
  async cancelRetry() {
    // Check if there's a retry pending
    if (!this.session.automation.retryPending) {
      throw new Error('No retry scheduled');
    }

    const batchNumber = this.session.automation.retryBatchNumber;
    console.log(`[AutomationController] Cancel retry requested for batch ${batchNumber}`);

    // Find the batch with retry scheduled (search in all batches)
    const batch = this.session.batches.find(b => b.batchNumber === batchNumber && b.retryScheduled);

    if (!batch) {
      throw new Error(`Batch ${batchNumber} not found or no retry scheduled`);
    }

    // Get the failed links that would have been retried
    const failedLinks = batch.results.filter(
      result =>
        result.status === 'failed' &&
        batch.retryScheduled.failedLinksToRetry.includes(result.linkId),
    );

    // Clear timers and countdowns
    if (this.retryTimers.has(batch.batchId)) {
      clearTimeout(this.retryTimers.get(batch.batchId));
      this.retryTimers.delete(batch.batchId);
      console.log(`[AutomationController] Cleared retry timer for batch ${batch.batchId}`);
    }

    if (this.retryCountdownIntervals.has(batch.batchId)) {
      clearInterval(this.retryCountdownIntervals.get(batch.batchId));
      this.retryCountdownIntervals.delete(batch.batchId);
      console.log(`[AutomationController] Cleared countdown for batch ${batch.batchId}`);
    }

    // Archive failed links permanently (no retry)
    failedLinks.forEach(result => {
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
          canRetry: false,
          canceledAt: new Date(),
        });
      }
    });

    console.log(
      `[AutomationController] Archived ${failedLinks.length} failed links (retry canceled)`,
    );

    // Clear retry pending flag
    this.session.automation.retryPending = false;
    this.session.automation.retryBatchNumber = null;

    // Clear retry scheduled info from batch
    batch.retryScheduled = null;

    // Emit cancel retry event
    this.emitSSE(this.userId, 'batch:retry_canceled', {
      batchNumber: batch.batchNumber,
      canceledCount: failedLinks.length,
    });

    // Resume normal batch processing if automation is still active
    if (this.session.automation.isActive) {
      console.log(
        '[AutomationController] Resuming normal batch processing after retry cancellation',
      );
      this.scheduleNextBatch();
    }

    return {
      success: true,
      batchNumber: batch.batchNumber,
      canceledCount: failedLinks.length,
    };
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

    // Restart countdown if there's a scheduled next batch time
    if (this.session.automation.nextBatchTime) {
      const nextRunTime = new Date(this.session.automation.nextBatchTime);
      const remainingMs = nextRunTime - Date.now();

      // Only restart countdown if there's still time remaining
      if (remainingMs > 0) {
        console.log('[AutomationController] Restarting countdown after resume...');

        // Clear any existing countdown interval first
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
        }

        // Restart countdown timer
        this.countdownInterval = setInterval(() => {
          // Check if automation is still active during countdown
          if (!this.session.automation.isActive || this.session.automation.isPaused) {
            console.log('[AutomationController] Automation paused/stopped during countdown');
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

        // Emit initial countdown update
        this.emitSSE(this.userId, 'countdown:update', {
          remainingMs: remainingMs,
          nextBatchTime: nextRunTime,
        });
      }
    }

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

    // ✅ CLEAR ALL RETRY TIMERS AND COUNTDOWNS
    this.retryTimers.forEach((timerId, batchId) => {
      clearTimeout(timerId);
      console.log(`[AutomationController] Cleared retry timer for batch ${batchId}`);
    });
    this.retryTimers.clear();

    this.retryCountdownIntervals.forEach((intervalId, batchId) => {
      clearInterval(intervalId);
      console.log(`[AutomationController] Cleared retry countdown for batch ${batchId}`);
    });
    this.retryCountdownIntervals.clear();

    // Clear retry pending flag
    this.session.automation.retryPending = false;
    this.session.automation.retryBatchNumber = null;

    // If there's a current batch, mark it as stopped and clear the reference
    if (this.session.currentBatch) {
      const currentBatch = this.getCurrentBatch();
      if (currentBatch) {
        currentBatch.status = 'stopped';
        currentBatch.endTime = new Date();
      }
      // Clear current batch reference so sync can work immediately after stop
      this.session.currentBatch = null;
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
   * Update current link processing status
   */
  updateCurrentLinkStatus(status, message, step = null) {
    if (!this.session.currentBatch) return;

    this.session.currentBatch.currentLinkStatus = {
      status,
      message,
      step,
      updatedAt: new Date(),
    };

    // Emit status update via SSE
    this.emitSSE(this.userId, 'link:status', {
      batchNumber: this.session.currentBatch.batchNumber,
      linkIndex: this.session.currentBatch.currentLinkIndex,
      status,
      message,
      step,
    });

    console.log(`[LinkStatus] ${step ? `[${step}]` : ''} ${status}: ${message}`);
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
      retryPending: this.session.automation.retryPending || false,
      retryBatchNumber: this.session.automation.retryBatchNumber || null,
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
