# Twitter Comment Automation - Architecture V2

## Overview
Complete redesign for batch-based sequential processing with real-time updates.

---

## Backend Architecture

### 1. Session Data Structure

```javascript
sessions[userId] = {
  // Source Data
  allLinks: [
    {
      id: "uuid",
      url: "https://x.com/...",
      content: "tweet text",
      comment: "generated comment",
      originalIndex: 0  // Position in Google Sheet
    }
  ],

  // Batch Management
  batches: [
    {
      batchId: 1,
      batchNumber: 1,
      links: [...],  // References to allLinks
      status: 'completed' | 'processing' | 'pending' | 'paused',
      startTime: Date,
      endTime: Date,
      successCount: 13,
      failedCount: 2,
      results: [
        {
          linkId: "uuid",
          status: 'success' | 'failed',
          error: "error message",
          processedAt: Date
        }
      ]
    }
  ],

  // Current State
  currentBatch: {
    batchId: 2,
    batchNumber: 2,
    currentLinkIndex: 3,  // Processing link #3 in batch
    status: 'processing' | 'paused',
    startedAt: Date
  },

  // Failed Links Archive
  failedLinks: [
    {
      linkId: "uuid",
      url: "https://x.com/...",
      comment: "generated comment",
      batchNumber: 1,
      error: "Timeout after 30s",
      failedAt: Date,
      canRetry: true
    }
  ],

  // Automation Settings
  automation: {
    isActive: true,
    isPaused: false,
    nextBatchTime: Date,
    intervalMinutes: 20,
    batchSize: 15,
    totalBatchesCompleted: 1,
    totalLinksProcessed: 15,
    totalSuccessful: 13,
    totalFailed: 2
  },

  // Settings
  settings: {
    googleSheetUrl: "",
    aiProvider: "gemini",
    apiKey: "",
    batchSize: 15,
    batchIntervalMinutes: 20,
    additionalPrompt: ""
  },

  // Browser Management
  browser: {
    isOpen: true,
    currentPageUrl: "https://x.com/...",
    lastActivityAt: Date
  }
}
```

---

### 2. New API Endpoints

#### Automation Control
```javascript
POST   /api/automation/start
  Body: { userId: string }
  Response: { success: bool, message: string, firstBatchId: string }

POST   /api/automation/stop
  Body: { userId: string }
  Response: { success: bool, message: string }

POST   /api/automation/pause
  Body: { userId: string }
  Response: { success: bool, currentBatch: object }

POST   /api/automation/resume
  Body: { userId: string }
  Response: { success: bool, resumedBatch: object }

POST   /api/automation/force-next
  Body: { userId: string }
  Response: { success: bool, nextBatchId: string, skippedLinks: array }

POST   /api/automation/sync-sheets
  Body: { userId: string, sheetUrl: string }
  Response: { success: bool, newLinks: array, totalLinks: number }

GET    /api/automation/status
  Query: ?userId=string
  Response: {
    isActive: bool,
    isPaused: bool,
    currentBatch: object,
    nextBatchTime: Date,
    stats: object
  }
```

#### Batch Management
```javascript
GET    /api/batches/current
  Query: ?userId=string
  Response: {
    batch: object,
    links: array,
    progress: { current: number, total: number, percentage: number }
  }

GET    /api/batches/history
  Query: ?userId=string
  Response: { batches: array, totalBatches: number }

GET    /api/batches/:batchId
  Response: { batch: object, links: array, results: array }
```

#### Failed Links
```javascript
GET    /api/failed-links
  Query: ?userId=string
  Response: { failedLinks: array, totalFailed: number }

POST   /api/failed-links/retry
  Body: { userId: string, linkIds: array }
  Response: { success: bool, retriedCount: number, results: array }

POST   /api/failed-links/clear
  Body: { userId: string, linkIds?: array }  // If no linkIds, clear all
  Response: { success: bool, clearedCount: number }
```

#### Real-time Updates (WebSocket/SSE)
```javascript
// SSE Endpoint
GET    /api/events/stream
  Query: ?userId=string
  Response: text/event-stream

  Events:
  - batch:started
  - batch:completed
  - link:processing
  - link:success
  - link:failed
  - automation:paused
  - automation:resumed
  - automation:stopped
  - countdown:update
```

---

### 3. Backend Services Refactor

#### PuppeteerService.js - Single Tab Processing

```javascript
class PuppeteerService {
  constructor() {
    this.browser = null;
    this.currentPage = null;  // Single persistent tab
    this.isProcessing = false;
    this.shouldPause = false;
    this.shouldStop = false;
  }

  // Keep browser open throughout
  async ensureBrowserOpen() {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch({...});
      this.currentPage = await this.browser.newPage();
      // Setup page configurations
    }
    return this.currentPage;
  }

  // Sequential batch processing with single tab
  async processBatchSequential(links, onProgress, onLinkComplete) {
    const page = await this.ensureBrowserOpen();
    const results = [];

    for (let i = 0; i < links.length; i++) {
      // Check pause/stop flags
      if (this.shouldStop) {
        return { stopped: true, results, processedCount: i };
      }

      while (this.shouldPause) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const link = links[i];

      // Progress callback
      onProgress({
        currentIndex: i,
        total: links.length,
        currentLink: link,
        percentage: Math.round((i / links.length) * 100)
      });

      try {
        // Navigate to link (reuse same tab)
        await page.goto(link.url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Auto-reply workflow: Like + Comment
        await this.autoReplyOnPage(page, link.comment);

        const result = {
          linkId: link.id,
          status: 'success',
          processedAt: new Date()
        };

        results.push(result);
        onLinkComplete(result);

      } catch (error) {
        const result = {
          linkId: link.id,
          status: 'failed',
          error: error.message,
          processedAt: new Date()
        };

        results.push(result);
        onLinkComplete(result);
      }

      // Delay between links
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return { completed: true, results, processedCount: links.length };
  }

  // Like and reply on current page
  async autoReplyOnPage(page, comment) {
    // Like logic
    await this.likePost(page);

    // Reply logic
    await this.replyToPost(page, comment);
  }

  setPause(shouldPause) {
    this.shouldPause = shouldPause;
  }

  setStop(shouldStop) {
    this.shouldStop = shouldStop;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.currentPage = null;
    }
  }
}
```

#### AutomationController.js - New Orchestrator

```javascript
class AutomationController {
  constructor(sessionData, puppeteerService, sseEmitter) {
    this.session = sessionData;
    this.puppeteer = puppeteerService;
    this.sse = sseEmitter;
    this.countdownInterval = null;
  }

  async start() {
    // 1. Fetch from Google Sheets if needed
    if (this.session.allLinks.length === 0) {
      await this.syncGoogleSheets();
    }

    // 2. Generate AI comments for all links if needed
    await this.generateCommentsForAll();

    // 3. Divide into batches
    this.createBatches();

    // 4. Start processing first batch
    this.session.automation.isActive = true;
    await this.processNextBatch();
  }

  async processNextBatch() {
    if (!this.session.automation.isActive) return;

    const nextBatch = this.getNextPendingBatch();
    if (!nextBatch) {
      this.session.automation.isActive = false;
      this.sse.emit('automation:completed', { totalBatches: this.session.batches.length });
      return;
    }

    // Update current batch
    this.session.currentBatch = {
      batchId: nextBatch.batchId,
      batchNumber: nextBatch.batchNumber,
      currentLinkIndex: 0,
      status: 'processing',
      startedAt: new Date()
    };

    nextBatch.status = 'processing';
    nextBatch.startTime = new Date();

    this.sse.emit('batch:started', { batch: nextBatch });

    // Process batch with callbacks
    const result = await this.puppeteer.processBatchSequential(
      nextBatch.links,
      (progress) => {
        this.session.currentBatch.currentLinkIndex = progress.currentIndex;
        this.sse.emit('link:processing', progress);
      },
      (linkResult) => {
        this.handleLinkResult(nextBatch, linkResult);
      }
    );

    // Update batch status
    nextBatch.status = result.stopped ? 'paused' : 'completed';
    nextBatch.endTime = new Date();
    nextBatch.results = result.results;

    // Calculate stats
    this.updateBatchStats(nextBatch);

    // Clear current batch
    this.session.currentBatch = null;

    this.sse.emit('batch:completed', { batch: nextBatch });

    // Archive failed links
    this.archiveFailedLinks(nextBatch);

    // Delete batch from allLinks (cleanup)
    this.deleteBatchLinks(nextBatch);

    if (!result.stopped) {
      // Schedule next batch
      this.scheduleNextBatch();
    }
  }

  handleLinkResult(batch, result) {
    if (result.status === 'success') {
      batch.successCount = (batch.successCount || 0) + 1;
      this.session.automation.totalSuccessful++;
      this.sse.emit('link:success', result);
    } else {
      batch.failedCount = (batch.failedCount || 0) + 1;
      this.session.automation.totalFailed++;
      this.sse.emit('link:failed', result);
    }
    this.session.automation.totalLinksProcessed++;
  }

  archiveFailedLinks(batch) {
    const failedResults = batch.results.filter(r => r.status === 'failed');
    failedResults.forEach(result => {
      const link = batch.links.find(l => l.id === result.linkId);
      this.session.failedLinks.push({
        linkId: link.id,
        url: link.url,
        comment: link.comment,
        content: link.content,
        batchNumber: batch.batchNumber,
        error: result.error,
        failedAt: result.processedAt,
        canRetry: true
      });
    });
  }

  deleteBatchLinks(batch) {
    const linkIds = batch.links.map(l => l.id);
    this.session.allLinks = this.session.allLinks.filter(
      link => !linkIds.includes(link.id)
    );
  }

  scheduleNextBatch() {
    const intervalMs = this.session.settings.batchIntervalMinutes * 60 * 1000;
    const nextRunTime = new Date(Date.now() + intervalMs);

    this.session.automation.nextBatchTime = nextRunTime;

    // Countdown timer
    this.countdownInterval = setInterval(() => {
      const remaining = nextRunTime - Date.now();
      if (remaining <= 0) {
        clearInterval(this.countdownInterval);
        this.processNextBatch();
      } else {
        this.sse.emit('countdown:update', {
          remainingMs: remaining,
          nextBatchTime: nextRunTime
        });
      }
    }, 1000);
  }

  async pause() {
    this.session.automation.isPaused = true;
    this.puppeteer.setPause(true);
    clearInterval(this.countdownInterval);
    this.sse.emit('automation:paused', { currentBatch: this.session.currentBatch });
  }

  async resume() {
    this.session.automation.isPaused = false;
    this.puppeteer.setPause(false);
    this.sse.emit('automation:resumed', { currentBatch: this.session.currentBatch });
  }

  async stop() {
    this.session.automation.isActive = false;
    this.session.automation.isPaused = false;
    this.puppeteer.setStop(true);
    clearInterval(this.countdownInterval);
    this.sse.emit('automation:stopped', {});
  }

  async forceNext() {
    const currentBatch = this.getCurrentBatch();
    if (currentBatch) {
      // Archive remaining unprocessed links as "skipped"
      const skippedLinks = currentBatch.links.slice(this.session.currentBatch.currentLinkIndex);
      skippedLinks.forEach(link => {
        this.session.failedLinks.push({
          linkId: link.id,
          url: link.url,
          comment: link.comment,
          batchNumber: currentBatch.batchNumber,
          error: 'Skipped by Force Next',
          failedAt: new Date(),
          canRetry: true
        });
      });

      // Stop current batch
      this.puppeteer.setStop(true);

      // Delete current batch
      this.deleteBatchLinks(currentBatch);

      // Process next immediately
      this.puppeteer.setStop(false);
      await this.processNextBatch();
    }
  }

  async syncGoogleSheets() {
    // Fetch from Google Sheets
    // Generate comments for new links
    // Add to allLinks
    // Recreate batches
  }

  createBatches() {
    const batchSize = this.session.settings.batchSize;
    this.session.batches = [];

    for (let i = 0; i < this.session.allLinks.length; i += batchSize) {
      this.session.batches.push({
        batchId: uuidv4(),
        batchNumber: Math.floor(i / batchSize) + 1,
        links: this.session.allLinks.slice(i, i + batchSize),
        status: 'pending',
        successCount: 0,
        failedCount: 0,
        results: []
      });
    }
  }

  getNextPendingBatch() {
    return this.session.batches.find(b => b.status === 'pending');
  }

  getCurrentBatch() {
    if (!this.session.currentBatch) return null;
    return this.session.batches.find(b => b.batchId === this.session.currentBatch.batchId);
  }
}
```

---

## Frontend Architecture

### 1. Component Structure

```
src/
├── App.jsx                          # Main app with tab navigation
├── components/
│   ├── tabs/
│   │   ├── SettingsTab.jsx          # Settings configuration
│   │   ├── CurrentBatchTab.jsx      # Main processing view
│   │   ├── FailedLinksTab.jsx       # Failed links history
│   │   └── OverallStatsTab.jsx      # Statistics dashboard
│   │
│   ├── batch/
│   │   ├── BatchProgressBar.jsx     # Progress visualization
│   │   ├── LinkStatusList.jsx       # List of links with status
│   │   ├── CurrentLinkDisplay.jsx   # Currently processing link
│   │   └── BatchControls.jsx        # Start/Stop/Pause/Resume/ForceNext
│   │
│   ├── countdown/
│   │   └── CountdownTimer.jsx       # Next batch countdown
│   │
│   ├── stats/
│   │   ├── StatsCards.jsx           # Overall statistics cards
│   │   └── SuccessRateChart.jsx     # Visual charts
│   │
│   └── failed/
│       ├── FailedLinkCard.jsx       # Individual failed link card
│       └── FailedLinkActions.jsx    # Retry/Copy/Open buttons
│
└── hooks/
    ├── useSSE.js                    # Server-Sent Events hook
    ├── useAutomation.js             # Automation state management
    └── useBatchProgress.js          # Batch progress tracking
```

### 2. State Management

```javascript
// App.jsx - Global State
const [automationState, setAutomationState] = useState({
  isActive: false,
  isPaused: false,
  currentBatch: null,
  nextBatchTime: null,
  stats: {
    totalBatches: 0,
    totalLinks: 0,
    successfulLinks: 0,
    failedLinks: 0,
    successRate: 0
  }
});

const [currentBatchDetails, setCurrentBatchDetails] = useState({
  batchNumber: 0,
  links: [],
  currentLinkIndex: 0,
  progress: 0
});

const [failedLinks, setFailedLinks] = useState([]);

const [settings, setSettings] = useState({
  googleSheetUrl: "",
  aiProvider: "gemini",
  apiKey: "",
  batchSize: 15,
  batchIntervalMinutes: 20,
  additionalPrompt: ""
});
```

### 3. SSE Integration

```javascript
// hooks/useSSE.js
export const useSSE = (userId, onEvent) => {
  useEffect(() => {
    const eventSource = new EventSource(`/api/events/stream?userId=${userId}`);

    eventSource.addEventListener('batch:started', (e) => {
      const data = JSON.parse(e.data);
      onEvent('batch:started', data);
    });

    eventSource.addEventListener('link:processing', (e) => {
      const data = JSON.parse(e.data);
      onEvent('link:processing', data);
    });

    eventSource.addEventListener('link:success', (e) => {
      const data = JSON.parse(e.data);
      onEvent('link:success', data);
    });

    eventSource.addEventListener('link:failed', (e) => {
      const data = JSON.parse(e.data);
      onEvent('link:failed', data);
    });

    eventSource.addEventListener('batch:completed', (e) => {
      const data = JSON.parse(e.data);
      onEvent('batch:completed', data);
    });

    eventSource.addEventListener('countdown:update', (e) => {
      const data = JSON.parse(e.data);
      onEvent('countdown:update', data);
    });

    // Cleanup
    return () => {
      eventSource.close();
    };
  }, [userId]);
};
```

---

## Implementation Order

### Phase 1: Backend Core
1. ✅ Architecture design document
2. Session structure refactor in server.js
3. SSE endpoint setup
4. PuppeteerService single-tab refactor
5. AutomationController implementation
6. New API routes

### Phase 2: Frontend UI
7. Tab layout restructure
8. CurrentBatchTab with real-time updates
9. FailedLinksTab with actions
10. OverallStatsTab
11. Settings updates
12. SSE hook integration

### Phase 3: Testing
13. E2E automation flow
14. Pause/Resume functionality
15. Force Next logic
16. Error handling

---

## Technical Decisions

### Why SSE instead of WebSocket?
- Simpler implementation for one-way server → client updates
- Automatic reconnection built-in
- HTTP-based, easier for proxies/firewalls
- Sufficient for our use case (no client → server real-time needed)

### Why Keep Browser Open?
- Faster processing (no launch overhead)
- Maintain Twitter session state
- Single tab navigation is lightweight

### Why Sequential Processing?
- More reliable than parallel (fewer race conditions)
- Easier error handling
- Simpler state management
- Lower resource usage

### Why Delete Processed Batches?
- Keep session data lean
- Archive only failures (needed for retry)
- Reduce memory footprint
- Prevent session bloat

---

## Next Steps

1. Start implementing backend refactor
2. Test SSE communication
3. Build frontend components
4. Integration testing
5. Production deployment updates
