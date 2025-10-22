# Twitter Comment Automation

A full-stack web application that automates Twitter comment generation using AI, with Google Sheets integration and Playwright web automation.

![Twitter Comment Automation](https://img.shields.io/badge/Status-Complete-brightgreen)
![React](https://img.shields.io/badge/React-18.2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![Playwright](https://img.shields.io/badge/Playwright-Latest-orange)

## 🚀 Features

- **📊 Google Sheets Integration**: Fetch Twitter URLs from spreadsheets
- **🎭 Modern Web Automation**: Reliable browser automation with Playwright
- **🤖 AI-Powered Comments**: Generate contextual comments using OpenAI GPT-4, Anthropic Claude, or Google Gemini
- **💼 Session Management**: Secure user sessions with isolated data storage
- **🎨 Modern UI**: Beautiful desktop-optimized interface with Chakra UI
- **⚡ Batch Processing**: Automated sequential processing with pause/resume controls
- **🔄 Real-time Updates**: Live status tracking and progress updates via SSE

## 🛠️ Tech Stack

### Frontend
- React 18 with Vite
- Chakra UI for components
- Axios for API calls
- Styled Components for custom styling

### Backend
- Node.js with Express
- ES6 modules
- Express Sessions for state management
- Google Sheets API
- Playwright for web automation
- OpenAI, Anthropic & Google Gemini SDKs

## 📦 Installation

### Prerequisites
- Node.js 16+
- npm or yarn
- Google Service Account (for Sheets API)
- OpenAI API Key or Anthropic API Key

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your API keys:
   ```env
   PORT=3001
   SESSION_SECRET=your-secret-key-change-in-production
   GOOGLE_SHEETS_API_KEY=your-google-api-key
   OPENAI_API_KEY=your-openai-key
   ANTHROPIC_API_KEY=your-anthropic-key
   GEMINI_API_KEY=your-gemini-key
   PLAYWRIGHT_HEADLESS=false
   ```

4. **Start the backend:**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

### Frontend Setup

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

4. **Open your browser:**
   ```
   http://localhost:5173
   ```

## 🎯 Usage

### 1. Configure Settings
- Navigate to the Settings tab
- Enter your Google Sheets URL (with Twitter URLs in column A, optional content in column B)
- Configure batch size and interval between batches
- Select AI provider (OpenAI, Anthropic, or Google Gemini)
- Add Twitter API credentials (cookies and bearer token)
- Save configuration

### 2. Start Automation
- Click "Start Automation" to begin the process
- The system will:
  1. Fetch links from Google Sheets
  2. Create batches automatically
  3. Fetch tweet content via Twitter API
  4. Generate AI comments for each batch
  5. Process tweets with Playwright (like + reply)

### 3. Monitor Progress
- View real-time batch progress
- See current tweet being processed
- Monitor success/failure counts
- View countdown to next batch

### 4. Control Automation
- **Pause**: Temporarily pause processing
- **Resume**: Continue from where you left off
- **Stop**: Stop automation completely
- **Force Next**: Skip to next batch immediately

### 5. Handle Failed Links
- View failed links in the Failed Links tab
- Retry failed links manually
- Clear failed links history

## 🔧 API Endpoints

### Automation
- `POST /api/automation/start` - Start automation process
- `POST /api/automation/stop` - Stop automation
- `POST /api/automation/pause` - Pause automation
- `POST /api/automation/resume` - Resume automation
- `POST /api/automation/force-next` - Skip to next batch
- `POST /api/automation/sync-sheets` - Sync with Google Sheets
- `GET /api/automation/status` - Get automation status
- `POST /api/automation/update-settings` - Update settings

### Browser Control
- `POST /api/browser/open` - Open browser
- `POST /api/browser/close` - Close browser
- `GET /api/browser/status` - Get browser status

### Batches
- `GET /api/batches` - Get all batches
- `GET /api/batches/:batchId` - Get specific batch

### Failed Links
- `GET /api/failed-links` - Get all failed links
- `POST /api/failed-links/retry` - Retry failed links
- `POST /api/failed-links/clear` - Clear failed links

## 🚦 Production Deployment

### Backend Deployment

1. **Set production environment variables:**
   ```env
   NODE_ENV=production
   PORT=3001
   SESSION_SECRET=secure-random-string
   PLAYWRIGHT_HEADLESS=false
   ```

2. **Install production dependencies only:**
   ```bash
   npm ci --only=production
   ```

3. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "twitter-automation"
   ```

### Frontend Deployment

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Serve with nginx or deploy to Vercel/Netlify**

## 🔍 Key Features

### Batch Processing
- Automatic batch creation from Google Sheets
- Configurable batch size (default: 15 tweets)
- Configurable interval between batches (default: 20 minutes)
- Sequential processing with single browser tab
- Pause/Resume/Stop controls

### AI Comment Generation
- Support for multiple AI providers:
  - OpenAI (GPT-4)
  - Anthropic (Claude)
  - Google Gemini
- Bulk comment generation for efficiency
- Custom prompt support
- 280 character limit for Twitter

### Browser Automation
- Playwright for reliable automation
- Single persistent tab for all operations
- Auto-wait for elements
- Natural typing simulation
- Like + Reply workflow

## 🐛 Troubleshooting

### Common Issues

1. **Playwright browser fails to launch:**
   ```bash
   # Install Playwright browsers
   npx playwright install chromium
   
   # Install required dependencies (Ubuntu/Debian)
   npx playwright install-deps chromium
   ```

2. **Google Sheets permission denied:**
   - Ensure service account has read access to the sheet
   - Share sheet with service account email
   - Check GOOGLE_SERVICE_ACCOUNT_PATH in .env

3. **AI API errors:**
   - Check API key validity in .env
   - Verify sufficient credits/quota
   - Ensure correct model names

4. **Twitter API errors:**
   - Configure Twitter cookies and bearer token in settings
   - Required for fetching tweet content
   - See TWITTER_API_REQUIRED_UPDATE.md for details

5. **Browser automation issues:**
   - Make sure browser is open before starting automation
   - Check browser status in UI
   - Use "Open Browser" button if needed

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review API documentation for external services

---

**Built with ❤️ by the Twitter Automation Team**