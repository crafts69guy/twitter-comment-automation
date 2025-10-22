# Twitter Comment Automation

A sophisticated full-stack web application that automates Twitter comment generation using AI, with Google Sheets integration and advanced Playwright web automation. Features batch-based sequential processing with real-time updates and comprehensive management tools.

![Twitter Comment Automation](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![React](https://img.shields.io/badge/React-18.2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![Playwright](https://img.shields.io/badge/Playwright-1.56.1-orange)
![Architecture](https://img.shields.io/badge/Architecture-V2%20Consolidated-blue)

## 🚀 Key Features

- **📊 Google Sheets Integration**: Seamlessly fetch Twitter URLs from spreadsheets
- **🎭 Advanced Web Automation**: Reliable single-tab automation with Playwright (migrated from Puppeteer)
- **🤖 Multi-AI Support**: Generate contextual comments using OpenAI GPT-4, Anthropic Claude, or Google Gemini
- **⚡ Smart Batch Processing**: Configurable batch-based sequential processing (15 links per batch)
- **🔄 Real-time Updates**: Live status tracking and progress updates via Server-Sent Events (SSE)
- **⏸️ Advanced Controls**: Pause/Resume, Force Next, and comprehensive automation management
- **📈 Statistics Dashboard**: Detailed analytics and performance metrics
- **🔧 Failed Links Management**: Retry, copy, and manage failed links with full history
- **⏰ Smart Scheduling**: Configurable intervals between batches with countdown timers
- **🎨 Modern UI**: Clean, desktop-optimized interface with Chakra UI

## 🛠️ Tech Stack

### Frontend
- **React 18** with Vite for fast development
- **Chakra UI** for modern, accessible components
- **Axios** for HTTP client
- **Server-Sent Events (SSE)** for real-time updates
- **Custom Hooks** for state management

### Backend
- **Node.js** with Express framework
- **ES6 Modules** for modern JavaScript
- **Express Sessions** for secure state management
- **Playwright 1.56.1** for reliable web automation (migrated from Puppeteer)
- **Google Sheets API** for spreadsheet integration
- **Multi-AI Support**: OpenAI, Anthropic Claude, Google Gemini
- **Server-Sent Events** for real-time communication

### Architecture
- **V2 Consolidated Architecture** - Clean, single-version codebase
- **Batch-Based Processing** - Sequential processing with configurable batches
- **Single-Tab Optimization** - Efficient browser resource usage
- **Session-Based Storage** - In-memory data management
- **Real-time Updates** - Live progress tracking via SSE

## 📦 Installation

### Prerequisites
- **Node.js 16+** (recommended: 18+)
- **npm** or **yarn**
- **Google Service Account** (for Sheets API)
- **AI API Key** (OpenAI, Anthropic, or Google Gemini)
- **Playwright browsers** (installed automatically)

### Quick Start (Docker - Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd twitter-comment-automation

# Start with Docker Compose
docker-compose up

# Access the application
open http://localhost
```

### Manual Installation

#### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   ```

4. **Configure environment variables:**
   Create `backend/.env`:
   ```env
   # Required
   GEMINI_API_KEY=your_gemini_api_key_here
   SESSION_SECRET=your_super_secret_key_here
   
   # Optional AI Providers
   OPENAI_API_KEY=your_openai_key
   ANTHROPIC_API_KEY=your_claude_key
   
   # Google Sheets (if using)
   GOOGLE_SERVICE_ACCOUNT_PATH=./google-credentials.json
   
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   PLAYWRIGHT_HEADLESS=false
   ```

5. **Add Google Service Account (optional):**
   - Download service account JSON from Google Cloud Console
   - Save as `backend/google-credentials.json`

6. **Start the backend:**
   ```bash
   npm run dev
   ```

#### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the frontend:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   ```
   Backend: http://localhost:3001
   Frontend: http://localhost:5173
   ```

## 🎯 Usage Guide

### 1. Initial Setup (Settings Tab)

**Configure your automation:**
- **Google Sheets URL**: Enter your spreadsheet URL (Twitter URLs in column A, optional content in column B)
- **Batch Settings**: 
  - Batch Size: 15 links per batch (configurable 1-50)
  - Interval: 20 minutes between batches (configurable 5-1440 minutes)
- **AI Provider**: Choose from OpenAI GPT-4, Anthropic Claude, or Google Gemini
- **API Key**: Enter your selected AI provider's API key
- **Additional Prompt**: Optional custom instructions for comment generation
- **Twitter Credentials**: Optional cookies and bearer token for enhanced functionality

### 2. Start Automation (Current Batch Tab)

**Click "Start Automation" to begin:**
1. **Fetch Links**: System retrieves all URLs from Google Sheets
2. **Generate Comments**: AI creates contextual comments for all links (bulk processing)
3. **Create Batches**: Links are divided into configurable batches
4. **Open Browser**: Single persistent Playwright tab launches
5. **Process First Batch**: Sequential processing begins

**Real-time Monitoring:**
- **Progress Bar**: Live updates showing current batch progress
- **Current Link**: Displays the Twitter URL being processed
- **Success/Failed Counts**: Real-time statistics
- **SSE Events**: Live updates via Server-Sent Events

### 3. Batch Processing Workflow

**For each link in a batch:**
1. **Navigate**: Browser goes to Twitter URL (reuses same tab)
2. **Like Post**: Automated like with realistic delays
3. **Reply**: 
   - Click reply button
   - Type comment character-by-character (30ms per character)
   - Submit reply
4. **Wait**: 3-second delay for success confirmation
5. **Next Link**: Move to next link in batch

**Between Links**: 2-second delay for rate limiting

### 4. Advanced Controls

**Pause/Resume:**
- **Pause**: Stops processing after current link completes
- **Resume**: Continues from next link in batch
- **Countdown**: Pauses between batches

**Force Next:**
- **Skip Current Batch**: Archives remaining unprocessed links as "skipped"
- **Immediate Next**: Starts next batch without delay
- **No Countdown**: Bypasses waiting period

**Stop Automation:**
- **Complete Stop**: Ends all processing
- **Clean Shutdown**: Saves current state
- **Browser Close**: Optionally closes browser

### 5. Failed Links Management (Failed Links Tab)

**View Failed Links:**
- **Grouped by Batch**: Organized by batch number
- **Error Details**: Full error messages and timestamps
- **Retry Status**: Shows which links can be retried

**Individual Actions:**
- **📋 Copy Comment**: Copy generated comment to clipboard
- **🔗 Open Link**: Open Twitter URL in new browser tab
- **🔄 Retry**: Manually retry single failed link

**Bulk Actions:**
- **Select Multiple**: Choose multiple failed links
- **🔄 Retry Selected**: Process multiple failed links
- **🗑️ Clear All**: Remove all failed links from history

### 6. Statistics Dashboard (Overall Stats Tab)

**Performance Metrics:**
- **Total Batches**: Completed vs pending
- **Links Processed**: Total count and success rate
- **Success/Failure Rates**: Detailed breakdown
- **Batch Progress**: Visual progress indicators
- **Performance Summary**: Color-coded feedback

**Real-time Updates:**
- **Live Statistics**: Updates during processing
- **Historical Data**: Track performance over time
- **Success Rate Trends**: Visual analytics

## 🔧 API Endpoints

### Automation Control (V2)
```
POST   /api/v2/automation/start            - Start automation process
POST   /api/v2/automation/stop             - Stop automation completely
POST   /api/v2/automation/pause            - Pause current batch
POST   /api/v2/automation/resume           - Resume paused batch
POST   /api/v2/automation/force-next       - Skip to next batch immediately
POST   /api/v2/automation/sync-sheets      - Refresh Google Sheets links
GET    /api/v2/automation/status           - Get automation status
POST   /api/v2/automation/update-settings  - Update automation settings
```

### Batch Management
```
GET    /api/v2/batches/current             - Get current batch details
GET    /api/v2/batches/history             - Get all batches history
GET    /api/v2/batches/:batchId            - Get specific batch details
```

### Failed Links Management
```
GET    /api/v2/failed-links                - Get all failed links
POST   /api/v2/failed-links/retry          - Retry selected failed links
POST   /api/v2/failed-links/clear          - Clear failed links history
GET    /api/v2/failed-links/:linkId        - Get specific failed link details
```

### Browser Control
```
GET    /api/v2/browser/status              - Get browser status
POST   /api/v2/browser/open                - Open Playwright browser
POST   /api/v2/browser/close               - Close browser
```

### Real-time Updates
```
GET    /api/events/stream                  - Server-Sent Events stream
```

**SSE Events:**
- `automation:started` - Automation begins
- `batch:started` - New batch processing starts
- `link:processing` - Link currently being processed
- `link:success` - Link processed successfully
- `link:failed` - Link processing failed
- `batch:completed` - Batch finished
- `countdown:update` - Countdown timer update (every second)
- `automation:paused` - Automation paused
- `automation:resumed` - Automation resumed
- `automation:stopped` - Automation stopped

## 🏗️ Architecture Overview

### V2 Consolidated Architecture

The application has been completely redesigned with a clean, single-version architecture:

**Key Improvements:**
- **Single-Tab Processing**: Replaces 5 parallel tabs with 1 persistent tab
- **Batch-Based Sequential Processing**: Configurable batches (default: 15 links)
- **Real-time Updates**: Server-Sent Events for live progress tracking
- **Advanced Error Handling**: Comprehensive failed links management
- **Smart Scheduling**: Configurable intervals with countdown timers
- **Session-Based Storage**: In-memory data management with cleanup

### Backend Architecture

**Core Services:**
- **PlaywrightService**: Single-tab automation with auto-waiting
- **AutomationController**: Batch orchestration and state management
- **AIService**: Multi-provider comment generation
- **GoogleSheetsService**: Spreadsheet integration

**Data Flow:**
1. **Fetch Links** → Google Sheets API
2. **Generate Comments** → AI Service (bulk processing)
3. **Create Batches** → Session storage
4. **Process Sequentially** → Playwright automation
5. **Real-time Updates** → SSE events
6. **Archive Failures** → Failed links storage

### Frontend Architecture

**Component Structure:**
- **App.jsx**: Main application with tab navigation
- **SettingsTab**: Configuration management
- **CurrentBatchTab**: Live processing view with real-time updates
- **FailedLinksTab**: Failed links management with retry/copy/open
- **OverallStatsTab**: Statistics dashboard
- **useSSE Hook**: Real-time event handling

**State Management:**
- **Session-based**: No database required
- **Real-time Sync**: SSE keeps UI updated
- **Local Storage**: Settings persistence

## 🚦 Production Deployment

### Docker Deployment (Recommended)

```bash
# Using Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t twitter-automation .
docker run -p 3001:3001 -p 80:80 twitter-automation
```

### Manual Deployment

#### Backend Setup

1. **Set production environment variables:**
   ```env
   NODE_ENV=production
   PORT=3001
   SESSION_SECRET=secure-random-string
   PLAYWRIGHT_HEADLESS=true
   GEMINI_API_KEY=your_production_key
   ```

2. **Install Playwright dependencies:**
   ```bash
   npx playwright install-deps chromium
   npx playwright install chromium
   ```

3. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "twitter-automation"
   ```

#### Frontend Deployment

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Serve with nginx:**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /path/to/frontend/dist;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

## 🔍 Advanced Features

### Smart Batch Processing
- **Automatic Batch Creation**: Divides links into configurable batches
- **Configurable Settings**: 15 links per batch (1-50), 20-minute intervals (5-1440 min)
- **Sequential Processing**: One link at a time for maximum reliability
- **Single Tab Optimization**: Reuses one persistent browser tab
- **Advanced Controls**: Pause/Resume/Stop/Force Next functionality

### Multi-AI Comment Generation
- **Three AI Providers**: OpenAI GPT-4, Anthropic Claude, Google Gemini
- **Bulk Processing**: Generates all comments at once for efficiency
- **Custom Prompts**: Additional instructions for comment generation
- **Character Limits**: Automatic 280-character Twitter limit compliance
- **Context Awareness**: Uses tweet content for relevant comments

### Playwright Web Automation
- **Migrated from Puppeteer**: Better reliability and performance
- **Auto-waiting**: Smart element detection and waiting
- **Natural Typing**: Character-by-character simulation (30ms per char)
- **Realistic Delays**: Human-like interaction patterns
- **Error Recovery**: Robust error handling and retry logic
- **Single Tab Efficiency**: Faster processing with resource optimization

### Real-time Monitoring
- **Server-Sent Events**: Live progress updates without polling
- **Progress Tracking**: Real-time batch and link progress
- **Statistics Dashboard**: Comprehensive performance metrics
- **Failed Links Management**: Full history with retry capabilities
- **Countdown Timers**: Visual countdown to next batch

## 🐛 Troubleshooting

### Common Issues

1. **Playwright browser fails to launch:**
   ```bash
   # Install Playwright browsers
   npx playwright install chromium
   
   # Install system dependencies (Ubuntu/Debian)
   npx playwright install-deps chromium
   
   # For Docker environments
   docker run --rm -v $(pwd):/app -w /app mcr.microsoft.com/playwright:v1.56.1-focal npx playwright install chromium
   ```

2. **Google Sheets integration issues:**
   - Ensure service account has read access to the sheet
   - Share sheet with service account email
   - Verify `GOOGLE_SERVICE_ACCOUNT_PATH` in .env points to correct file
   - Check Google Cloud Console for API quotas

3. **AI API errors:**
   - Verify API key validity in .env file
   - Check sufficient credits/quota for your AI provider
   - Ensure correct model names (gpt-4, claude-3, gemini-pro)
   - Test API key with a simple request

4. **SSE connection issues:**
   - Check browser console for connection errors
   - Verify backend is running on correct port
   - Ensure no firewall blocking SSE connections
   - Try refreshing the page to reconnect

5. **Browser automation problems:**
   - Ensure browser is open before starting automation
   - Check browser status in the UI
   - Use "Open Browser" button if needed
   - Verify Playwright can access Chrome/Chromium
   - Check for Twitter rate limiting (increase delays if needed)

6. **Session data issues:**
   - Session data is stored in memory (lost on server restart)
   - For production, consider Redis for persistent storage
   - Check available memory for large datasets

### Performance Optimization

**For Large Datasets:**
- Reduce batch size (e.g., 10 instead of 15)
- Increase delays between links (e.g., 3-5 seconds)
- Monitor memory usage during processing
- Consider processing in smaller chunks

**For Rate Limiting:**
- Increase delays in PlaywrightService configuration
- Use different Twitter accounts for rotation
- Implement exponential backoff for retries

## 📊 Performance Metrics

### Expected Performance
- **Single Link Processing**: 40-60 seconds per link
- **Batch Processing**: 10-15 minutes for 15 links
- **Full Automation**: 3-4 hours for 100 links (7 batches)
- **Memory Usage**: ~200MB for typical workloads
- **Success Rate**: 85-95% depending on Twitter stability

### Configuration Options
```javascript
// Timing Configuration (in PlaywrightService)
PRE_LIKE_DELAY: 2500          // Before clicking like
POST_LIKE_DELAY: 5000         // After clicking like
TYPING_DELAY_PER_CHAR: 30     // Between each character
PRE_SUBMIT_DELAY: 3000        // Before clicking submit
POST_SUBMIT_DELAY: 3000       // After submitting reply
BETWEEN_LINKS_DELAY: 2000     // Between processing links
```

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly with different batch sizes
5. Submit a pull request

## 📞 Support

For issues and questions:
- **GitHub Issues**: Create an issue with detailed logs
- **Documentation**: Check the troubleshooting section above
- **API Reference**: Review external service documentation
- **Performance**: Monitor browser console for SSE events

## 🎯 Roadmap

### Planned Features
- [ ] Redis integration for persistent storage
- [ ] Multi-user support with authentication
- [ ] Advanced analytics and reporting
- [ ] Email notifications for batch completion
- [ ] CSV export for statistics
- [ ] Advanced scheduling with cron jobs
- [ ] Mobile-responsive UI improvements

---

**Built with ❤️ using Playwright, React, and modern web technologies**

*Last updated: October 2025 - V2 Architecture Consolidated*