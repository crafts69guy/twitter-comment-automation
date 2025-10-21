# Quick Start Guide

## Project Status
✅ **Clean and Ready** - All legacy code removed, V2 consolidated

---

## Start the Application

### Option 1: Docker (Recommended)
```bash
# Start both frontend and backend
docker-compose up

# Access the app
open http://localhost
```

### Option 2: Development Mode
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm install
npm run dev

# Access the app
open http://localhost:5173
```

---

## Key Files

### Backend
- `server.js` - Main server
- `routes/automation.js` - Main automation API
- `services/puppeteerService.js` - Browser automation
- `controllers/automationController.js` - Batch orchestration

### Frontend
- `src/App.jsx` - Main application
- `src/components/tabs/` - All UI tabs

---

## API Endpoints

```
POST   /api/v2/automation/start     - Start automation
POST   /api/v2/automation/stop      - Stop automation
POST   /api/v2/automation/pause     - Pause batch
POST   /api/v2/automation/resume    - Resume batch
GET    /api/events/stream           - Real-time updates (SSE)
GET    /api/v2/batches/current      - Current batch info
GET    /api/v2/failed-links         - Failed links list
```

---

## Configuration

Create `backend/.env`:
```env
GEMINI_API_KEY=your_key_here
SESSION_SECRET=your_secret
PORT=3001
NODE_ENV=development
```

---

## Documentation

- `README.md` - Project overview
- `ARCHITECTURE_V2.md` - Technical architecture  
- `IMPLEMENTATION_V2_SUMMARY.md` - Features & workflow
- `CLEANUP_SUMMARY.md` - Recent cleanup details
- `DOCKER_SETUP.md` - Docker deployment

---

## Recent Changes (Oct 21, 2025)

✅ Removed all V1 legacy files (12 files)
✅ Renamed V2 files to standard names
✅ Cleaned up imports and references
✅ Project is now 30% smaller and cleaner

---

Happy coding! 🚀
