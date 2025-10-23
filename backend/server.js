import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// V2 Routes (only routes currently in use)
import automationRouter from './routes/automation.js';
import batchesRouter from './routes/batches.js';
import failedLinksRouter from './routes/failedLinks.js';
import browserRouter from './routes/browser.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'twitter-automation-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// Session storage with new V2 structure
const sessions = {};

// SSE clients storage
const sseClients = new Map();

// Initialize or get session with V2 structure
const initializeSession = userId => {
  if (!sessions[userId]) {
    sessions[userId] = {
      // Source Data
      allLinks: [],

      // Batch Management
      batches: [],

      // Current State
      currentBatch: null,

      // Failed Links Archive
      failedLinks: [],

      // Automation Settings
      automation: {
        isActive: false,
        isPaused: false,
        nextBatchTime: null,
        intervalMinutes: 20,
        batchSize: 15,
        totalBatchesCompleted: 0,
        totalLinksProcessed: 0,
        totalSuccessful: 0,
        totalFailed: 0,
      },

      // Settings
      settings: {
        googleSheetUrl: '',
        aiProvider: 'gemini',
        batchSize: 15,
        batchIntervalMinutes: 20,
        additionalPrompt: '',
        twitterCookies: '',
        twitterBearerToken: '',
        retryFailureThreshold: 30,
        retryDelayLow: 5,
        retryDelayHigh: 10,
      },

      // Browser Management
      browser: {
        isOpen: false,
        currentPageUrl: null,
        lastActivityAt: null,
      },
    };
  }
  return sessions[userId];
};

app.use((req, _res, next) => {
  if (!req.session.userId) {
    req.session.userId = uuidv4();
  }

  req.userSession = initializeSession(req.session.userId);
  req.userId = req.session.userId;
  next();
});

// SSE endpoint for real-time updates
app.get('/api/events/stream', (req, res) => {
  const userId = req.userId;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  // Store client connection
  sseClients.set(userId, res);

  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(userId);
  });
});

// Helper function to emit SSE events
export const emitSSE = (userId, eventType, data) => {
  const client = sseClients.get(userId);
  if (client) {
    client.write(`event: ${eventType}\n`);
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
};

// Make sessions and SSE available to routes
app.set('sessions', sessions);
app.set('emitSSE', emitSSE);

// V2 API Routes
app.use('/api/v2/automation', automationRouter);
app.use('/api/v2/batches', batchesRouter);
app.use('/api/v2/failed-links', failedLinksRouter);
app.use('/api/v2/browser', browserRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', sessionId: req.session.userId });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
