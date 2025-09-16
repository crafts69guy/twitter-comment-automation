import express from 'express';
import session from 'express-session';
import cors from 'cors';
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import googleSheetsRouter from './routes/googleSheets.js';
import scraperRouter from './routes/scraper.js';
import aiRouter from './routes/ai.js';
import postsRouter from './routes/posts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'twitter-automation-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const sessions = {};

app.use((req, res, next) => {
  if (!req.session.userId) {
    req.session.userId = uuidv4();
  }
  if (!sessions[req.session.userId]) {
    sessions[req.session.userId] = {
      posts: [],
      settings: {
        googleSheetUrl: '',
        aiProvider: 'openai',
        apiKey: ''
      }
    };
  }
  req.userSession = sessions[req.session.userId];
  next();
});

app.use('/api/google-sheets', googleSheetsRouter);
app.use('/api/scraper', scraperRouter);
app.use('/api/ai', aiRouter);
app.use('/api/posts', postsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', sessionId: req.session.userId });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});