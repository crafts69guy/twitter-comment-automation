import { useState, useEffect } from 'react';

/**
 * Custom hook for syncing state with localStorage with auto-save and debouncing
 * @param {string} key - localStorage key
 * @param {any} initialValue - initial value if no localStorage value exists
 * @param {number} debounceMs - debounce delay in milliseconds (default: 500ms)
 * @returns {[value, setValue, hasUnsavedChanges, resetChanges]}
 */
export function useLocalStorageSync(key, initialValue, debounceMs = 500) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-save to localStorage with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasUnsavedChanges) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          console.log(`Auto-saved ${key} to localStorage`);
        } catch (error) {
          console.error(`Error saving ${key} to localStorage:`, error);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, hasUnsavedChanges, key, debounceMs]);

  // Custom setValue that tracks changes
  const setValueAndTrackChanges = newValue => {
    setValue(newValue);
    setHasUnsavedChanges(true);
  };

  // Reset unsaved changes flag
  const resetChanges = () => {
    setHasUnsavedChanges(false);
  };

  // Force save immediately
  const forceSave = () => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
      return false;
    }
  };

  return [value, setValueAndTrackChanges, hasUnsavedChanges, resetChanges, forceSave];
}

/**
 * Custom hook specifically for settings management
 * @param {object} parentSettings - settings from parent component
 * @param {function} onUpdate - callback when settings are saved
 * @returns {object} settings management utilities
 */
export function useSettings(parentSettings, onUpdate) {
  const [localSettings, setLocalSettings, hasUnsavedChanges, resetChanges, forceSave] =
    useLocalStorageSync('twitterAutomationSettings', parentSettings, 500);

  // Sync with parent settings when they change
  useEffect(() => {
    setLocalSettings(parentSettings);
    resetChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentSettings]);

  const updateSetting = (field, value) => {
    setLocalSettings({ ...localSettings, [field]: value });
  };

  const updateScheduledSetting = (field, value) => {
    setLocalSettings({
      ...localSettings,
      scheduledAutomation: {
        enabled: false,
        intervalMinutes: 20,
        batchSize: 10,
        startImmediately: true,
        ...localSettings.scheduledAutomation,
        [field]: value,
      },
    });
  };

  const saveSettings = () => {
    const success = forceSave();
    if (success) {
      onUpdate(localSettings);
    }
    return success;
  };

  return {
    settings: localSettings,
    hasUnsavedChanges,
    updateSetting,
    updateScheduledSetting,
    saveSettings,
  };
}
