Twitter Comment Automation - Detailed Build Instructions
Project Overview
Build a web application that connects to Google Sheets, scrapes Twitter posts using 5 parallel Puppeteer tabs, generates AI comments, and manages them in a clean table interface with session-based storage.
📋 Requirements Checklist
React + Vite frontend with Chakra UI + Styled Components
Node.js + Express backend
Google Sheets API integration (no file uploads)
Puppeteer with 5 parallel tabs for Twitter scraping
Claude API or OpenAI for comment generation
Session-based storage (no database)
Table interface for managing posts and comments
Open a new tab with a link to the post and reply with generated comment
Mark replied/pending status
