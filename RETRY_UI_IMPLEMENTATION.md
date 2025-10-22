# Retry UI Implementation

## 📱 UI Component: RetryCountdown

### Overview
A beautiful and informative React component that displays automatic retry information with real-time countdown.

### Location
`frontend/src/components/RetryCountdown.jsx`

### Features

#### 1. **Retry Scheduled View** 🕒
Hiển thị khi batch có lỗi và retry được schedule:

**UI Elements:**
- 🎯 **Large Countdown Timer**: MM:SS format với badge lớn màu cam
- 📊 **Batch Information Cards**:
  - Batch Number (blue badge)
  - Failed Links Count (red badge)
  - Failure Rate % (orange badge)
  - Retry Delay in minutes (purple badge)
- 📈 **Animated Progress Bar**: Shows time until retry
- ℹ️ **Informative Messages**:
  - Explains why retry delay is 5min (< 30% failure) or 10min (≥ 30% failure)
  - Warning that new batches are paused during retry

**Visual Design:**
- Orange/yellow theme (warning status)
- Smooth animations and transitions
- Real-time countdown updates every second
- Striped and animated progress bar

#### 2. **Retrying View** 🔄
Hiển thị khi đang retry:

**UI Elements:**
- Spinning refresh icon animation
- "Retrying Batch X" message
- Processing status for Y links

**Visual Design:**
- Blue theme (info status)
- Animated spinning icon

#### 3. **Retry Completed View** ✅
Hiển thị sau khi retry hoàn tất (5 giây):

**UI Elements:**
- Success/Warning badge depending on results
- Success count (green badge)
- Failed count (red badge)
- Total links processed

**Visual Design:**
- Green theme for success
- Orange theme if some links still failed
- Auto-dismiss after 5 seconds

### Integration

#### SSE Events Listened:
```javascript
'batch:retry_scheduled' // Khi retry được schedule
'retry:countdown'        // Update countdown mỗi giây
'batch:retry_started'    // Khi bắt đầu retry
'batch:retry_completed'  // Khi retry hoàn tất
```

#### Usage in App.jsx:
```jsx
import RetryCountdown from './components/RetryCountdown';

function App() {
  const { eventSource } = useSSE(SSE_URL, sseEventHandlers, true);
  
  return (
    <>
      <RetryCountdown eventSource={eventSource} />
      {/* Other components */}
    </>
  );
}
```

### State Management

Component manages its own state:
- `retryInfo`: Stores batch info, delay, failure rate, etc.
- `countdown`: Real-time remaining time in milliseconds
- `isRetrying`: Boolean flag for retry in progress

### Data Flow

```
Backend                    SSE Event                Frontend Component
--------                   ---------                ------------------
Batch fails     →  batch:retry_scheduled    →    Show countdown UI
                   (batch info, delay)
                   
Every 1s        →  retry:countdown          →    Update countdown
                   (remainingMs)                  Update progress bar
                   
Start retry     →  batch:retry_started      →    Show "Retrying" UI
                   
Retry done      →  batch:retry_completed    →    Show results
                   (success/fail counts)          Auto-hide after 5s
```

### UI/UX Features

#### Responsive Design
- Mobile-friendly layout
- Stacks on small screens
- Clean spacing and typography

#### Visual Feedback
- Color-coded status (orange → blue → green)
- Animated progress bar with stripes
- Smooth transitions between states
- Icons for better visual understanding

#### Information Density
- All critical info visible at a glance
- Clear hierarchy (timer → details → context)
- No information overload
- Progressive disclosure

#### User Experience
- Non-intrusive (shows only when needed)
- Auto-dismisses when complete
- Real-time updates (no manual refresh)
- Clear countdown timer

### Styling

Uses **Chakra UI** components:
- `Alert` for container
- `Badge` for stats display
- `Progress` for countdown visualization
- `HStack/VStack` for layout
- `Icon` from `react-icons/fi`

**Theme Colors:**
- Orange/Yellow: Warning (scheduled)
- Blue: Info (retrying)
- Green: Success (completed)
- Red: Error (failed items)

### Example Screenshots (Text Description)

#### Scheduled State:
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Automatic Retry Scheduled          ⏱️ [04:23]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Batch: #5    Failed: 8    Rate: 22.5%    Delay: 5min │
│                                                         │
│  Time until retry                        4m 23s remain │
│  [█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 65%          │
│                                                         │
│  🔄 Low failure rate - retrying failed links after    │
│     5 minutes                                          │
│  ⚠️  New batches are paused until retry completes     │
└─────────────────────────────────────────────────────────┘
```

#### Retrying State:
```
┌─────────────────────────────────────────────────────────┐
│ 🔄  Retrying Batch 5                                   │
│                                                         │
│  Processing 8 failed links...                          │
└─────────────────────────────────────────────────────────┘
```

#### Completed State:
```
┌─────────────────────────────────────────────────────────┐
│ ✅  Retry Completed for Batch 5                        │
│                                                         │
│  ✓ 6 Succeeded    ✗ 2 Failed    Total: 8 links       │
└─────────────────────────────────────────────────────────┘
```

### Technical Details

#### Performance
- Countdown updates throttled to 1 second intervals
- Minimal re-renders (only when data changes)
- Event listeners properly cleaned up on unmount
- No memory leaks

#### Error Handling
- Gracefully handles missing eventSource
- Safe JSON parsing with try-catch
- Null checks for all data
- Defensive programming throughout

#### Accessibility
- Semantic HTML structure
- ARIA labels for screen readers
- Color contrast meets WCAG standards
- Keyboard navigation friendly

### Future Enhancements

Potential improvements:
- [ ] Sound notification when retry starts
- [ ] Manual cancel retry button
- [ ] Show list of failed links in dropdown
- [ ] Retry history timeline
- [ ] Export failed links to CSV
- [ ] Customize retry delay via UI

### Testing Checklist

- [x] Component mounts without errors
- [x] Countdown updates every second
- [x] Progress bar animates correctly
- [x] State transitions smoothly
- [x] Auto-dismisses after completion
- [x] Event listeners cleanup properly
- [x] Mobile responsive layout
- [x] Color themes correct for each state

### Related Files

**Backend:**
- `backend/controllers/automationController.js` - Retry logic & SSE events

**Frontend:**
- `frontend/src/components/RetryCountdown.jsx` - Component
- `frontend/src/App.jsx` - Integration
- `frontend/src/hooks/useSSE.js` - SSE connection

**Documentation:**
- `IMPLEMENTATION_V2_SUMMARY.md` - Backend retry mechanism
- `RETRY_UI_IMPLEMENTATION.md` - This file

---

## 🎨 Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `eventSource` | EventSource | Yes | SSE connection object from useSSE hook |

## 🔧 Dependencies

```json
{
  "@chakra-ui/react": "^2.x",
  "react": "^18.x",
  "react-icons": "^4.x"
}
```

## 📝 Notes

- Component is self-contained and manages its own state
- No external state management required
- Automatically shows/hides based on retry status
- SSE events must be properly emitted from backend
- Countdown timer is accurate to the second
- Component cleanup prevents memory leaks

## ✅ Implementation Status

**Backend:** ✅ Complete
- Automatic retry logic implemented
- SSE events emitting correctly
- Countdown timer working
- Retry mechanism tested

**Frontend:** ✅ Complete
- RetryCountdown component created
- Integrated into App.jsx
- SSE events properly handled
- UI tested and responsive

**Integration:** ✅ Complete
- useSSE hook updated to export eventSource
- Component receives SSE events
- Real-time updates working
- State transitions smooth

---

Created: 2025-10-22
Last Updated: 2025-10-22
