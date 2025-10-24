# Coding Guidelines for Agentic Developers

## Build/Test/Lint Commands

### Frontend (React + Vite)

- **Lint**: `cd frontend && npm run lint`
- **Build**: `cd frontend && npm run build`
- **Dev**: `cd frontend && npm run dev`
- **No tests configured** - add test framework if needed

### Backend (Node.js + Express)

- **Start**: `cd backend && npm start`
- **Dev**: `cd backend && npm run dev` (uses nodemon)
- **No tests/lint configured** - no linting setup for backend

## Code Style Guidelines

### Imports & Module System

- Use **ES6 modules** (`import`/`export`) - both frontend and backend use `"type": "module"`
- Group imports: external libraries, then local modules
- React: destructure hooks and components from packages

### Formatting & Naming

- **Variables/functions**: camelCase (`fetchAutomationStatus`, `isActive`)
- **Constants**: camelCase (`SETTINGS_STORAGE_KEY`, `API_BASE`)
- **Components**: PascalCase (`SettingsTab`, `RetryCountdown`)
- **React hooks**: `use` prefix (`useSSE`, `useLocalStorage`)

### Types & Validation

- **No TypeScript** - project uses JavaScript only (though .jsx files supported)
- Use JSDoc comments for function documentation (optional but recommended)
- Validate settings/API responses with `try/catch` blocks

### Error Handling

- Always wrap async operations in `try/catch`
- Log errors with context: `console.error('Context message:', error)`
- Emit SSE error events for user feedback: `this.emitSSE(userId, 'error', { message, details })`
- Use axios interceptors for API error handling

### State Management

- **Frontend**: React hooks (`useState`, `useCallback`, `useMemo`, `useEffect`)
- **Backend**: In-memory object maps (`sessions`, `sseClients`) for session data
- Use `useCallback` for stable function references in dependency arrays
- Handle localStorage with try/catch (quota/permissions errors)

### React/Frontend Patterns

- Use **Chakra UI** for components (styled-components available too)
- SSE (Server-Sent Events) for real-time updates via custom `useSSE` hook
- Set `withCredentials: true` on axios calls for session handling
- Suppress eslint warnings with inline comments: `// eslint-disable-next-line hook-deps`

### API & Express Patterns

- Use middleware: `app.use()` for CORS, JSON parsing, sessions
- Endpoint format: `/api/v2/{resource}/{action}` (e.g., `/api/v2/automation/start`)
- Validate `req.userSession` and `req.userId` from middleware
- Use `res.json()` with `{ success: boolean, data/message }` response format
- Wrap async route handlers in try/catch

### Playwright/Browser Automation

- Access via `playwrightService` service class
- Always check `browserStatus.isOpen` and `isLoggedIn` before operations
- Emit SSE events for long-running operations
- Handle browser connection failures gracefully

## Key Directories

- `backend/`: Express server, controllers, services, routes
- `frontend/src/`: React app, components, hooks, CSS
- `.env.example`: Template for environment variables
