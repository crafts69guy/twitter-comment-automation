import { useState, useEffect, useCallback, useMemo } from 'react';
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
import RetryCountdown from './components/RetryCountdown';

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
      twitterUsername: '',
      twitterPassword: '',
      twitterVerificationHandle: '',
      twitterCookies: '',
      twitterBearerToken: '',
    };
  };

  // Save settings to localStorage
  const saveSettingsToStorage = newSettings => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      console.log('Saved settings to localStorage:', newSettings);
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
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
    isLoggedIn: false,
    currentUrl: null,
  });

  const [countdown, setCountdown] = useState({
    remainingMs: 0,
    nextBatchTime: null,
  });

  const [activityLogs, setActivityLogs] = useState([]);

  // Sync settings to backend on mount
  useEffect(() => {
    const syncSettingsToBackend = async () => {
      try {
        const response = await axios.post(`${API_BASE}/automation/update-settings`, settings, {
          withCredentials: true,
        });

        if (response.data.success) {
          setIsSynced(true);
        }
      } catch (error) {
        console.error('Error syncing settings to backend:', error);
      }
    };

    // Only sync if settings contain some configuration
    if (settings.twitterUsername || settings.googleSheetUrl) {
      syncSettingsToBackend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Helper function to add log entries (max 100 entries)
  const addLog = useCallback((type, title, message, details = null) => {
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
  }, []);

  // API functions
  const fetchAutomationStatus = useCallback(async () => {
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
  }, []);

  const fetchCurrentBatch = useCallback(async () => {
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
  }, []);

  const fetchFailedLinks = useCallback(async () => {
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
  }, []);

  const fetchBrowserStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/browser/status`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setBrowserStatus({
          isOpen: response.data.isOpen,
          isLoggedIn: response.data.isLoggedIn || false,
          currentUrl: response.data.currentUrl,
        });
      }
    } catch (error) {
      console.error('Error fetching browser status:', error);
    }
  }, []);

  const startAutomation = useCallback(async () => {
    try {
      // Sync settings to backend before starting (to ensure latest credentials are sent)
      console.log('🔄 Syncing settings before starting automation...');
      console.log('📊 Current credentials in localStorage:', {
        hasBearerToken: !!settings.twitterBearerToken,
        bearerTokenLength: settings.twitterBearerToken?.length || 0,
        hasCookies: !!settings.twitterCookies,
        cookiesLength: settings.twitterCookies?.length || 0,
      });

      await axios.post(`${API_BASE}/automation/update-settings`, settings, {
        withCredentials: true,
      });

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
  }, [settings, toast]);

  const stopAutomation = useCallback(async () => {
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
  }, [toast]);

  const pauseAutomation = useCallback(async () => {
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
  }, [toast]);

  const resumeAutomation = useCallback(async () => {
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
  }, [toast]);

  const forceNextBatch = useCallback(async () => {
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
  }, [toast]);

  const syncGoogleSheets = useCallback(async () => {
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
  }, [toast]);

  const updateSettings = useCallback(
    async newSettings => {
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
    },
    [toast],
  );

  const openBrowser = useCallback(async () => {
    try {
      // First, sync settings to ensure backend has latest credentials
      console.log('🔄 Syncing settings before opening browser...');
      const syncResponse = await axios.post(`${API_BASE}/automation/update-settings`, settings, {
        withCredentials: true,
      });

      if (!syncResponse.data.success) {
        throw new Error('Failed to sync settings');
      }

      console.log('✅ Settings synced successfully');
      setIsSynced(true);

      // Now open browser with synced credentials
      const response = await axios.post(
        `${API_BASE}/browser/open`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        setBrowserStatus({
          isOpen: true,
          isLoggedIn: response.data.isLoggedIn || false,
          currentUrl: null,
        });

        // Check if credentials were extracted during login
        if (response.data.extractedCredentials) {
          const { bearerToken, cookies } = response.data.extractedCredentials;
          console.log('📥 Received extracted credentials from browser open response');

          // Update settings in state and localStorage
          setSettings(prev => {
            const updated = { ...prev };

            if (bearerToken && bearerToken.trim() !== '') {
              updated.twitterBearerToken = bearerToken;
              console.log('✅ Updated twitterBearerToken in localStorage');
            }

            if (cookies && cookies.trim() !== '') {
              updated.twitterCookies = cookies;
              console.log('✅ Updated twitterCookies in localStorage');
            }

            // Save to localStorage immediately
            saveSettingsToStorage(updated);

            return updated;
          });

          // Log to Activity Log
          addLog(
            'success',
            '🔑 Twitter Credentials Extracted',
            'Bearer Token and Cookies extracted from browser and saved to localStorage',
            {
              bearerTokenLength: bearerToken?.length || 0,
              cookiesCount: cookies?.split(';').length || 0,
              extractedAt: new Date().toISOString(),
            },
          );

          toast({
            title: '✅ Credentials Extracted!',
            description: 'Bearer Token and Cookies saved to localStorage',
            status: 'success',
            duration: 3000,
          });
        } else {
          toast({
            title: 'Browser Opened',
            status: 'success',
            duration: 2000,
          });
        }
      }
    } catch (error) {
      console.error('Error opening browser:', error);
      const errorMessage = error.response?.data?.message || 'Failed to open browser';

      // Auto-close browser on error to prevent zombie state
      console.log('🔄 Auto-closing browser due to error...');
      try {
        await axios.post(
          `${API_BASE}/browser/close`,
          {},
          {
            withCredentials: true,
          },
        );
        console.log('✅ Browser auto-closed successfully');
      } catch (closeError) {
        console.error('⚠️ Failed to auto-close browser:', closeError);
      }

      // Update UI state to reflect browser is closed
      setBrowserStatus({ isOpen: false, isLoggedIn: false, currentUrl: null });

      // Log error to activity log
      addLog('error', '❌ Browser Open Failed', errorMessage, {
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
      });
    }
  }, [addLog, settings, toast]);

  const closeBrowser = useCallback(async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/browser/close`,
        {},
        {
          withCredentials: true,
        },
      );
      if (response.data.success) {
        setBrowserStatus({ isOpen: false, isLoggedIn: false, currentUrl: null });
        toast({
          title: 'Browser Closed',
          status: 'info',
          duration: 2000,
        });
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }, [toast]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE Event handlers
  const sseEventHandlers = useMemo(
    () => ({
      'automation:started': data => {
        console.log('Automation started:', data);
        addLog(
          'success',
          'Automation Started',
          `Processing ${data.totalBatches} batches with ${data.totalLinks} links`,
          data,
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
          data.batch,
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

      'link:status': data => {
        console.log('Link status update:', data);
        setCurrentBatchDetails(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            currentLinkStatus: {
              status: data.status,
              message: data.message,
              step: data.step,
              updatedAt: new Date(),
            },
          };
        });

        // Add to activity log for important status updates
        const importantStatuses = [
          'navigating',
          'liking',
          'typing',
          'submitting',
          'completed',
          'failed',
        ];
        if (importantStatuses.includes(data.status)) {
          const logType =
            data.status === 'completed' ? 'success' : data.status === 'failed' ? 'error' : 'info';

          addLog(logType, `[Batch ${data.batchNumber}] Link Status: ${data.status}`, data.message, {
            linkIndex: data.linkIndex,
            step: data.step,
          });
        }
      },

      'link:success': data => {
        console.log('Link success:', data);
        addLog(
          'success',
          `Link Success [Batch ${data.batchNumber}]`,
          data.url || 'Link completed',
          data,
        );
        fetchCurrentBatch();
      },

      'link:failed': data => {
        console.log('Link failed:', data);
        addLog(
          'error',
          `Link Failed [Batch ${data.batchNumber}]`,
          data.url || data.error || 'Processing failed',
          data,
        );
        fetchCurrentBatch();
        fetchFailedLinks();
      },

      'link:retry_success': data => {
        console.log('Link retry success:', data);
        addLog(
          'success',
          `Retry Succeeded [Batch ${data.batchNumber}]`,
          data.url || 'Link retried successfully',
          data,
        );
        fetchCurrentBatch();
      },

      'link:retry_failed': data => {
        console.log('Link retry failed:', data);
        addLog(
          'error',
          `Retry Failed [Batch ${data.batchNumber}]`,
          data.url || data.error || 'Retry failed',
          data,
        );
        fetchCurrentBatch();
        fetchFailedLinks();
      },

      'batch:completed': data => {
        console.log('Batch completed:', data);
        addLog(
          data.batch.failedCount > 0 ? 'warning' : 'success',
          `Batch ${data.batch.batchNumber} Completed`,
          `Success: ${data.batch.successCount}, Failed: ${data.batch.failedCount}`,
          data.batch,
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

      'batch:retry_scheduled': data => {
        console.log('Retry scheduled:', data);
        const retryTime = new Date(data.retryAt).toLocaleTimeString();
        addLog(
          'warning',
          `🔄 Retry Scheduled [Batch ${data.batchNumber}]`,
          `${data.failedCount} failed links will be retried at ${retryTime} (${data.delayMinutes}min delay)`,
          {
            ...data,
            failureRate: `${data.failureRate}%`,
          },
        );
        toast({
          title: `Retry Scheduled for Batch ${data.batchNumber}`,
          description: `${data.failedCount} links will retry in ${data.delayMinutes} minutes`,
          status: 'info',
          duration: 5000,
        });
        // Fetch status to update retryPending flag
        fetchAutomationStatus();
      },

      'batch:retry_started': data => {
        console.log('Retry started:', data);
        addLog(
          'info',
          `🔄 Retry Started [Batch ${data.batchNumber}]`,
          `Retrying ${data.retryCount} failed links...`,
          data,
        );
        toast({
          title: `Retrying Batch ${data.batchNumber}`,
          description: `Processing ${data.retryCount} failed links`,
          status: 'info',
          duration: 3000,
        });
        // Fetch current batch to show retry progress
        fetchCurrentBatch();
        fetchAutomationStatus();
      },

      'batch:retry_completed': data => {
        console.log('Retry completed:', data);
        addLog(
          data.failedCount > 0 ? 'warning' : 'success',
          `✅ Retry Completed [Batch ${data.batchNumber}]`,
          `Success: ${data.successCount}, Still Failed: ${data.failedCount}, Total: ${data.totalRetried}`,
          data,
        );
        toast({
          title: `Retry Completed for Batch ${data.batchNumber}`,
          description: `${data.successCount} succeeded, ${data.failedCount} still failed`,
          status: data.failedCount > 0 ? 'warning' : 'success',
          duration: 5000,
        });
        // Update all statuses
        setCurrentBatchDetails(null);
        fetchAutomationStatus();
        fetchFailedLinks();
      },

      'batch:force_retry': data => {
        console.log('Force retry triggered:', data);
        addLog(
          'info',
          `⚡ Force Retry Triggered [Batch ${data.batchNumber}]`,
          `Skipping countdown - retrying ${data.linkCount} links immediately`,
          data,
        );
      },

      'batch:retry_canceled': data => {
        console.log('Retry canceled:', data);
        addLog(
          'warning',
          `🚫 Retry Canceled [Batch ${data.batchNumber}]`,
          `${data.canceledCount} failed links archived. Continuing to next batch.`,
          data,
        );
        toast({
          title: `Retry Canceled for Batch ${data.batchNumber}`,
          description: `${data.canceledCount} failed links archived`,
          status: 'warning',
          duration: 3000,
        });
        // Update status
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
          data.stats,
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
          data,
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
          data,
        );
        toast({
          title: 'Sheets Synced',
          description: `Added ${data.newLinks} new links`,
          status: 'success',
          duration: 3000,
        });
      },

      'credentials:extracted': data => {
        console.log('Credentials extracted from browser (via SSE):', data);

        // Update local settings with extracted credentials (actual tokens, not display text)
        if (data.bearerToken || data.cookies) {
          setSettings(prev => {
            const updated = { ...prev };

            // Only update if we have actual credential values (not empty strings)
            if (data.bearerToken && data.bearerToken.trim() !== '') {
              updated.twitterBearerToken = data.bearerToken;
              console.log('✅ Updated twitterBearerToken in localStorage (SSE)');
            }

            if (data.cookies && data.cookies.trim() !== '') {
              updated.twitterCookies = data.cookies;
              console.log('✅ Updated twitterCookies in localStorage (SSE)');
            }

            // Save to localStorage immediately
            saveSettingsToStorage(updated);

            return updated;
          });

          // Log to Activity Log
          addLog(
            'success',
            '🔑 Twitter Credentials Extracted (Re-login)',
            data.message || 'Bearer Token and Cookies extracted after re-authentication',
            {
              bearerTokenLength: data.bearerToken?.length || 0,
              cookiesCount: data.cookies?.split(';').length || 0,
              extractedAt: new Date().toISOString(),
              source: 'SSE Event',
            },
          );
        }

        toast({
          title: '✅ Credentials Extracted!',
          description:
            'Bearer Token and Cookies have been automatically extracted and saved to localStorage',
          status: 'success',
          duration: 5000,
          isClosable: true,
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
          data,
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
    }),
    [addLog, fetchAutomationStatus, fetchCurrentBatch, fetchFailedLinks, toast],
  );

  // Initialize SSE connection
  const { isConnected, eventSource } = useSSE(SSE_URL, sseEventHandlers, true);

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

          {/* Retry Countdown Component */}
          <RetryCountdown eventSource={eventSource} />

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
                <ActivityLogTab logs={activityLogs} onClearLogs={() => setActivityLogs([])} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Container>
      </Box>
    </ChakraProvider>
  );
}

export default App;
