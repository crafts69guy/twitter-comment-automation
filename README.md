# Twitter Comment Automation

A full-stack web application that automates Twitter comment generation using AI, with Google Sheets integration and Puppeteer web scraping.

![Twitter Comment Automation](https://img.shields.io/badge/Status-Complete-brightgreen)
![React](https://img.shields.io/badge/React-18.2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![Puppeteer](https://img.shields.io/badge/Puppeteer-Latest-orange)

## 🚀 Features

- **📊 Google Sheets Integration**: Fetch Twitter URLs from spreadsheets
- **🕷️ Parallel Web Scraping**: 5 concurrent Puppeteer tabs for efficient Twitter scraping
- **🤖 AI-Powered Comments**: Generate contextual comments using OpenAI GPT-4 or Anthropic Claude
- **💼 Session Management**: Secure user sessions with isolated data storage
- **🎨 Modern UI**: Beautiful desktop-optimized interface with Chakra UI
- **⚡ Bulk Operations**: Generate comments for multiple posts simultaneously
- **🔄 Real-time Updates**: Live status tracking and progress updates

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
- Puppeteer for web scraping
- OpenAI & Anthropic SDKs

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
   PUPPETEER_HEADLESS=true
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
- Enter your Google Sheets URL
- Select AI provider (OpenAI or Anthropic)
- Enter your API key
- Save configuration

### 2. Fetch Posts
- Go to Posts Management tab
- Click "Fetch Posts" to load Twitter URLs from your Google Sheet
- Posts will appear in the table

### 3. Scrape Content
- Click "Scrape Content" to extract actual Twitter post content
- This uses 5 parallel Puppeteer browsers for efficiency

### 4. Generate Comments
- Click individual chat icons (💬) to generate AI comments for specific posts
- Or use "Generate All Comments" for bulk processing
- Comments are contextually relevant based on post content

### 5. Reply to Posts
- Click the green check icon (✅) on posts with generated comments
- This opens Twitter in a new tab for you to reply
- Status automatically updates to "Replied"

## 🔧 API Endpoints

### Google Sheets
- `POST /api/google-sheets/fetch` - Fetch posts from Google Sheets

### Scraper
- `POST /api/scraper/scrape-posts` - Real Puppeteer scraping
- `POST /api/scraper/scrape-demo` - Demo mode with mock data

### AI Generation
- `POST /api/ai/generate` - Real AI generation (OpenAI/Claude)
- `POST /api/ai/generate-demo` - Demo contextual comments

### Posts Management
- `GET /api/posts/current` - Get current session posts
- `PATCH /api/posts/:postId` - Update specific post

## 🚦 Production Deployment

### Backend Deployment

1. **Set production environment variables:**
   ```env
   NODE_ENV=production
   PORT=3001
   SESSION_SECRET=secure-random-string
   PUPPETEER_HEADLESS=true
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

## 🔍 Development Features

### Demo Mode
The application includes comprehensive demo modes for testing without external APIs:

- **Mock Google Sheets data**: Simulated spreadsheet responses
- **Demo scraping**: Contextual fake Twitter content
- **AI demo comments**: Smart responses based on content analysis
- **No API limits**: Test unlimited without consuming quotas

### Real Integration
Switch to real APIs by:
- Uncommenting production code blocks
- Adding valid API keys
- Enabling real Puppeteer scraping
- Connecting to actual Google Sheets

## 🐛 Troubleshooting

### Common Issues

1. **Puppeteer fails to launch:**
   ```bash
   # Install required dependencies (Ubuntu/Debian)
   sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2
   ```

2. **Google Sheets permission denied:**
   - Ensure service account has read access to the sheet
   - Share sheet with service account email

3. **AI API errors:**
   - Check API key validity
   - Verify sufficient credits/quota
   - Ensure correct model names

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