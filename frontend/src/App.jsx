import { useState, useEffect } from 'react';
import {
  ChakraProvider,
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Container,
  Heading,
  Badge,
  useToast,
} from '@chakra-ui/react';
import axios from 'axios';
import useSSE from './hooks/useSSE';

// Import tab components
import SettingsTab from './components/tabs/SettingsTab';
import CurrentBatchTab from './components/tabs/CurrentBatchTab';
import FailedLinksTab from './components/tabs/FailedLinksTab';
import OverallStatsTab from './components/tabs/OverallStatsTab';
import ActivityLogTab from './components/tabs/ActivityLogTab';

// Determine API URL based on environment
const API_URL =
  window.location.hostname === 'localhost' &&
  window.location.port !== '80' &&
  window.location.port !== ''
    ? 'http://localhost:3001'
    : '';

const API_BASE = `${API_URL}/api/v2`;
const SSE_URL = `${API_URL}/api/events/stream`;

function App() {
  const toast = useToast();

  // LocalStorage key for settings
  const SETTINGS_STORAGE_KEY = 'twitter-automation-settings';

  // Load settings from localStorage or use defaults
  const loadSettingsFromStorage = () => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('Loaded settings from localStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    }
    // Return defaults if nothing in storage
    return {
      googleSheetUrl: '',
      aiProvider: 'gemini',
      batchSize: 15,
      batchIntervalMinutes: 20,
      additionalPrompt: '',
      twitterCookies: '',
      twitterBearerToken: '',
    };
  };

  // State management
  const [settings, setSettings] = useState(loadSettingsFromStorage());
  const [isSynced, setIsSynced] = useState(false);

  const [automationStatus, setAutomationStatus] = useState({
    isActive: false,
    isPaused: false,
    currentBatch: null,
    nextBatchTime: null,
    stats: {
      totalBatchesCompleted: 0,
      totalLinksProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalBatches: 0,
      pendingBatches: 0,
    },
  });

  const [currentBatchDetails, setCurrentBatchDetails] = useState(null);
  const [failedLinks, setFailedLinks] = useState([]);
  const [browserStatus, setBrowserStatus] = useState({
    isOpen: false,
    currentUrl: null,
  });

  const [countdown, setCountdown] = useState({
    remainingMs: 0,
    nextBatchTime: null,
  });

  const [activityLogs, setActivityLogs] = useState([]);

  // Helper function to add log entries (max 100 entries)
  const addLog = (type, title, message, details = null) => {
    const newLog = {
      id: Date.now() + Math.random(), // Unique ID
      timestamp: new Date().toLocaleString(),
      type, // 'success', 'error', 'warning', 'info'
      title,
      message,
      details,
    };

    setActivityLogs(prev => {
      const updated = [newLog, ...prev];
      // Keep only last 100 logs
      return updated.slice(0, 100);
    });
  };

  // SSE Event handlers
  const sseEventHandlers = {
    'automation:started': data => {
      console.log('Automation started:', data);
      addLog(
        'success',
        'Automation Started',
        `Processing ${data.totalBatches} batches with ${data.totalLinks} links`,
        data
      );
      toast({
        title: 'Automation Started',
        description: `Processing ${data.totalBatches} batches with ${data.totalLinks} links`,
        status: 'success',
        duration: 3000,
      });
      fetchAutomationStatus();
    },

    'batch:started': data => {
      console.log('Batch started:', data);
      addLog(
        'info',
        `Batch ${data.batch.batchNumber} Started`,
        `Processing ${data.batch.totalLinks} links`,
        data.batch
      );
      toast({
        title: `Batch ${data.batch.batchNumber} Started`,
        description: `Processing ${data.batch.totalLinks} links`,
        status: 'info',
        duration: 2000,
      });
      fetchCurrentBatch();
    },

    'link:processing': data => {
      console.log('Processing link:', data);
      setCurrentBatchDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentLinkIndex: data.currentIndex,
          progress: data.percentage,
          currentLink: data.currentLink,
        };
      });
    },

    'link:success': data => {
      console.log('Link success:', data);
      addLog('success', 'Link Processed Successfully', data.url || 'Link completed', data);
      fetchCurrentBatch();
    },

    'link:failed': data => {
      console.log('Link failed:', data);
      addLog('error', 'Link Failed', data.error || 'Processing failed', data);
      fetchCurrentBatch();
      fetchFailedLinks();
    },

    'batch:completed': data => {
      console.log('Batch completed:', data);
      addLog(
        data.batch.failedCount > 0 ? 'warning' : 'success',
        `Batch ${data.batch.batchNumber} Completed`,
        `Success: ${data.batch.successCount}, Failed: ${data.batch.failedCount}`,
        data.batch
      );
      toast({
        title: `Batch ${data.batch.batchNumber} Completed`,
        description: `Success: ${data.batch.successCount}, Failed: ${data.batch.failedCount}`,
        status: data.batch.failedCount > 0 ? 'warning' : 'success',
        duration: 3000,
      });
      setCurrentBatchDetails(null);
      fetchAutomationStatus();
      fetchFailedLinks();
    },

    'batch:scheduled': data => {
      console.log('Batch scheduled:', data);
      const nextTime = new Date(data.nextBatchTime).toLocaleTimeString();
      addLog('info', 'Next Batch Scheduled', `Waiting until ${nextTime}`, data);
      setCountdown({
        nextBatchTime: new Date(data.nextBatchTime),
        remainingMs: new Date(data.nextBatchTime) - Date.now(),
      });
    },

    'countdown:update': data => {
      setCountdown({
        nextBatchTime: new Date(data.nextBatchTime),
        remainingMs: data.remainingMs,
      });
    },

    'automation:paused': data => {
      console.log('Automation paused:', data);
      addLog('info', 'Automation Paused', 'Processing paused by user', data);
      toast({
        title: 'Automation Paused',
        status: 'info',
        duration: 2000,
      });
      fetchAutomationStatus();
    },

    'automation:resumed': data => {
      console.log('Automation resumed:', data);
      addLog('success', 'Automation Resumed', 'Processing resumed', data);
      toast({
        title: 'Automation Resumed',
        status: 'success',
        duration: 2000,
      });
      fetchAutomationStatus();
    },

    'automation:stopped': data => {
      console.log('Automation stopped:', data);
      addLog('warning', 'Automation Stopped', 'Automation stopped by user', data);
      toast({
        title: 'Automation Stopped',
        status: 'warning',
        duration: 2000,
      });
      setAutomationStatus(prev => ({
        ...prev,
        isActive: false,
        isPaused: false,
        currentBatch: null,
        nextBatchTime: null,
      }));
      setCurrentBatchDetails(null);
      setCountdown({
        remainingMs: 0,
        nextBatchTime: null,
      });
    },

    'automation:completed': data => {
      console.log('Automation completed:', data);
      addLog(
        'success',
        'Automation Completed',
        `All batches processed. Success: ${data.stats.totalSuccessful}, Failed: ${data.stats.totalFailed}`,
        data.stats
      );
      toast({
        title: 'Automation Completed',
        description: `All batches processed. Success: ${data.stats.totalSuccessful}, Failed: ${data.stats.totalFailed}`,
        status: 'success',
        duration: 5000,
      });
      fetchAutomationStatus();
    },

    'batch:skipped': data => {
      console.log('Batch skipped:', data);
      addLog(
        'warning',
        'Batch Skipped',
        `Skipped ${data.skippedLinks} links from batch ${data.batchNumber}`,
        data
      );
      toast({
        title: 'Batch Skipped',
        description: `Skipped ${data.skippedLinks} links from batch ${data.batchNumber}`,
        status: 'warning',
        duration: 3000,
      });
    },

    'sheets:synced': data => {
      console.log('Sheets synced:', data);
      addLog(
        'success',
        'Google Sheets Synced',
        `Added ${data.newLinks} new links. Total: ${data.totalLinks}`,
        data
      );
      toast({
        title: 'Google Sheets Synced',
        description: `Added ${data.newLinks} new links. Total: ${data.totalLinks}`,
        status: 'success',
        duration: 3000,
      });
    },

    'comments:generated': data => {
      console.log('Comments generated:', data);
      addLog('success', 'Comments Generated', `Generated ${data.count} AI comments`, data);
      toast({
        title: 'Comments Generated',
        description: `Generated ${data.count} AI comments`,
        status: 'success',
        duration: 2000,
      });
    },

    'content:fetched': data => {
      console.log('Content fetched:', data);
      addLog(
        data.failedCount > 0 ? 'warning' : 'success',
        'Tweet Content Fetched',
        `Fetched ${data.successCount}/${data.totalLinks} tweets (${data.failedCount} failed)`,
        data
      );
      toast({
        title: 'Tweet Content Fetched',
        description: `Fetched ${data.successCount}/${data.totalLinks} tweets (${data.failedCount} failed)`,
        status: data.failedCount > 0 ? 'warning' : 'success',
        duration: 3000,
      });
    },

    error: data => {
      console.error('Error:', data);
      addLog('error', data.message || 'Error', data.details || '', data);
      toast({
        title: data.message || 'Error',
        description: data.details || 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    },

    warning: data => {
      console.warn('Warning:', data);
      addLog('warning', data.message || 'Warning', data.details || '', data);
      toast({
        title: data.message || 'Warning',
        description: data.details || '',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      });
    },
  };

  // Initialize SSE connection
  const { isConnected, reconnect } = useSSE(SSE_URL, sseEventHandlers, true);

  // API functions
  const fetchAutomationStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/automation/status`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setAutomationStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching automation status:', error);
    }
  };

  const fetchCurrentBatch = async () => {
    try {
      const response = await axios.get(`${API_BASE}/batches/current`, {
        withCredentials: true,
      });
      if (response.data.success && response.data.currentBatch) {
        setCurrentBatchDetails(response.data.currentBatch);
      }
    } catch (error) {
      console.error('Error fetching current batch:', error);
    }
  };

  const fetchFailedLinks = async () => {
    try {
      const response = await axios.get(`${API_BASE}/failed-links`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setFailedLinks(response.data.failedLinks);
      }
    } catch (error) {
      console.error('Error fetching failed links:', error);
    }
  };

  const fetchBrowserStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/browser/status`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setBrowserStatus({
          isOpen: response.data.isOpen,
          currentUrl: response.data.currentUrl,
        });
      }
    } catch (error) {
      console.error('Error fetching browser status:', error);
    }
  };

  const startAutomation = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/automation/start`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        toast({
          title: 'Automation Starting',
          description: response.data.message,
          status: 'success',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error starting automation:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to start automation',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const stopAutomation = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/automation/stop`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        toast({
          title: 'Automation Stopped',
          status: 'warning',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error stopping automation:', error);
    }
  };

  const pauseAutomation = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/automation/pause`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        toast({
          title: 'Automation Paused',
          status: 'info',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error pausing automation:', error);
    }
  };

  const resumeAutomation = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/automation/resume`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        toast({
          title: 'Automation Resumed',
          status: 'success',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error resuming automation:', error);
    }
  };

  const forceNextBatch = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/automation/force-next`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        toast({
          title: 'Forced Next Batch',
          description: response.data.message,
          status: 'success',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error forcing next batch:', error);
    }
  };

  const syncGoogleSheets = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/automation/sync-sheets`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        toast({
          title: 'Sheets Synced',
          description: response.data.message,
          status: 'success',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error syncing sheets:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to sync sheets',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const updateSettings = async newSettings => {
    try {
      const response = await axios.post(`${API_BASE}/automation/update-settings`, newSettings, {
        withCredentials: true,
      });
      if (response.data.success) {
        const updatedSettings = response.data.settings;
        setSettings(updatedSettings);
        
        // Save to localStorage
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
          console.log('Settings saved to localStorage:', updatedSettings);
          setIsSynced(true);
        } catch (storageError) {
          console.error('Error saving settings to localStorage:', storageError);
        }
        
        toast({
          title: 'Settings Updated',
          status: 'success',
          duration: 1000,
        });
        
        return { success: true, settings: updatedSettings };
      }
      return { success: false, error: 'Failed to update settings' };
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        status: 'error',
        duration: 3000,
      });
      return { success: false, error: error.message };
    }
  };

  const openBrowser = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/browser/open`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        setBrowserStatus({ isOpen: true, currentUrl: null });
        toast({
          title: 'Browser Opened',
          status: 'success',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error opening browser:', error);
      toast({
        title: 'Error',
        description: 'Failed to open browser',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const closeBrowser = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/browser/close`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        setBrowserStatus({ isOpen: false, currentUrl: null });
        toast({
          title: 'Browser Closed',
          status: 'info',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  };

  // Initialize on mount
  useEffect(() => {
    // Fetch automation status and sync with backend
    const initializeApp = async () => {
      try {
        // Fetch current settings from backend
        const statusResponse = await axios.get(`${API_BASE}/automation/status`, {
          withCredentials: true,
        });
        
        if (statusResponse.data.success && statusResponse.data.settings) {
          const backendSettings = statusResponse.data.settings;
          
          // Merge backend settings with localStorage (backend takes priority)
          setSettings(prevSettings => {
            const mergedSettings = { ...prevSettings, ...backendSettings };
            
            // Update localStorage with backend settings
            try {
              localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(mergedSettings));
              console.log('Synced settings from backend to localStorage:', mergedSettings);
              setIsSynced(true);
            } catch (error) {
              console.error('Error saving to localStorage:', error);
            }
            
            return mergedSettings;
          });
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        // Keep localStorage settings if backend fails
        console.log('Using localStorage settings as fallback');
        setIsSynced(false);
      }
    };

    initializeApp();
    fetchAutomationStatus();
    fetchFailedLinks();
    fetchBrowserStatus();

    // Poll browser status every 10 seconds
    const interval = setInterval(() => {
      fetchBrowserStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ChakraProvider>
      <Box minH="100vh" minW="100vw" bg="gray.50" py={8}>
        <Container maxW="container.xl">
          {/* Header */}
          <Box mb={8} textAlign="center">
            <Heading size="xl" mb={2}>
              Twitter Comment Automation
            </Heading>
            <Box>
              <Badge colorScheme={isConnected ? 'green' : 'red'} mr={2}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Badge colorScheme={automationStatus.isActive ? 'blue' : 'gray'}>
                {automationStatus.isActive
                  ? automationStatus.isPaused
                    ? 'Paused'
                    : 'Active'
                  : 'Inactive'}
              </Badge>
            </Box>
          </Box>

          {/* Tabs */}
          <Tabs variant="enclosed" colorScheme="blue">
            <TabList>
              <Tab>Settings</Tab>
              <Tab>
                Current Batch
                {currentBatchDetails && (
                  <Badge ml={2} colorScheme="blue">
                    Processing
                  </Badge>
                )}
              </Tab>
              <Tab>
                Failed Links
                {failedLinks.length > 0 && (
                  <Badge ml={2} colorScheme="red">
                    {failedLinks.length}
                  </Badge>
                )}
              </Tab>
              <Tab>Overall Stats</Tab>
              <Tab>
                Activity Log
                {activityLogs.length > 0 && (
                  <Badge ml={2} colorScheme="purple">
                    {activityLogs.length}
                  </Badge>
                )}
              </Tab>
            </TabList>

            <TabPanels>
              {/* Settings Tab */}
              <TabPanel>
                <SettingsTab
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  onSyncSheets={syncGoogleSheets}
                  isSynced={isSynced}
                />
              </TabPanel>

              {/* Current Batch Tab */}
              <TabPanel>
                <CurrentBatchTab
                  automationStatus={automationStatus}
                  currentBatchDetails={currentBatchDetails}
                  browserStatus={browserStatus}
                  countdown={countdown}
                  onStart={startAutomation}
                  onStop={stopAutomation}
                  onPause={pauseAutomation}
                  onResume={resumeAutomation}
                  onForceNext={forceNextBatch}
                  onOpenBrowser={openBrowser}
                  onCloseBrowser={closeBrowser}
                />
              </TabPanel>

              {/* Failed Links Tab */}
              <TabPanel>
                <FailedLinksTab failedLinks={failedLinks} onRefresh={fetchFailedLinks} />
              </TabPanel>

              {/* Overall Stats Tab */}
              <TabPanel>
                <OverallStatsTab stats={automationStatus.stats} />
              </TabPanel>

              {/* Activity Log Tab */}
              <TabPanel>
                <ActivityLogTab
                  logs={activityLogs}
                  onClearLogs={() => setActivityLogs([])}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Container>
      </Box>
    </ChakraProvider>
  );
}

export default App;
