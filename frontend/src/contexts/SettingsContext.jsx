import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SettingsContext = createContext();

// Determine API URL based on environment
const API_URL =
  window.location.hostname === 'localhost' &&
  window.location.port !== '80' &&
  window.location.port !== ''
    ? 'http://localhost:3001'
    : '';

const API_BASE = `${API_URL}/api/v2`;
const SETTINGS_STORAGE_KEY = 'twitter-automation-settings';

// Default settings
const DEFAULT_SETTINGS = {
  googleSheetUrl: '',
  aiProvider: 'gemini',
  batchSize: 15,
  batchIntervalMinutes: 20,
  additionalPrompt: '',
  twitterCookies: '',
  twitterBearerToken: '',
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    // Try to load from localStorage first
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
    return DEFAULT_SETTINGS;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      console.log('Settings auto-saved to localStorage:', settings);
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  }, [settings]);

  // Sync with backend on mount
  useEffect(() => {
    const syncWithBackend = async () => {
      try {
        const response = await axios.get(`${API_BASE}/automation/status`, {
          withCredentials: true,
        });

        if (response.data.success && response.data.settings) {
          const backendSettings = response.data.settings;
          console.log('Fetched settings from backend:', backendSettings);

          // Merge with current settings (backend takes priority for set values)
          setSettings(prev => ({
            ...prev,
            ...backendSettings,
          }));
          setIsSynced(true);
        }
      } catch (error) {
        console.error('Error syncing settings with backend:', error);
        // Keep localStorage settings if backend fails
        console.log('Using localStorage settings as fallback');
      } finally {
        setIsLoading(false);
      }
    };

    syncWithBackend();
  }, []);

  // Update settings (saves to both localStorage and backend)
  const updateSettings = async (newSettings) => {
    try {
      // Optimistically update local state and localStorage
      setSettings(newSettings);

      // Update backend
      const response = await axios.post(
        `${API_BASE}/automation/update-settings`,
        newSettings,
        { withCredentials: true }
      );

      if (response.data.success) {
        const updatedSettings = response.data.settings;
        setSettings(updatedSettings);
        setIsSynced(true);
        return { success: true, settings: updatedSettings };
      }

      return { success: false, error: 'Failed to update settings' };
    } catch (error) {
      console.error('Error updating settings:', error);
      // Revert to previous settings on error
      return { success: false, error: error.message };
    }
  };

  // Reset to defaults
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    setIsSynced(false);
  };

  // Clear localStorage
  const clearStoredSettings = () => {
    try {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      console.log('Cleared settings from localStorage');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  const value = {
    settings,
    setSettings,
    updateSettings,
    resetSettings,
    clearStoredSettings,
    isLoading,
    isSynced,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
