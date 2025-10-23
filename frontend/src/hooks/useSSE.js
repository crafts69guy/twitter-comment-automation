import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Custom hook for Server-Sent Events (SSE)
 * @param {string} url - SSE endpoint URL
 * @param {object} eventHandlers - Object mapping event names to handler functions
 * @param {boolean} enabled - Whether to enable SSE connection
 * @returns {object} - { isConnected, eventSource, reconnect, disconnect }
 */
export const useSSE = (url, eventHandlers = {}, enabled = true) => {
  const eventSourceRef = useRef(null);
  const [eventSource, setEventSource] = useState(null);
  const [isConnected, setIsConnected] = useState(false); // Use state instead of ref
  const reconnectTimeoutRef = useRef(null);
  const eventHandlersRef = useRef(eventHandlers);

  // Update event handlers ref when they change
  useEffect(() => {
    eventHandlersRef.current = eventHandlers;
  }, [eventHandlers]);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) {
      return;
    }

    try {
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;
      setEventSource(eventSource);

      // Handle connection open
      eventSource.onopen = () => {
        console.log('[SSE] Connected');
        setIsConnected(true);
      };

      // Handle initial connection event
      eventSource.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            window.__sseUserId = data.userId; // Store for debugging
          }
        } catch (error) {
          console.error('[SSE] Error parsing message:', error);
        }
      };

      // Handle errors
      eventSource.onerror = () => {
        console.error('[SSE] Connection error, reconnecting...');
        setIsConnected(false);

        // Close and attempt reconnect
        eventSource.close();
        eventSourceRef.current = null;
        setEventSource(null);

        // Reconnect after 3 seconds
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      // Register custom event handlers using ref
      Object.entries(eventHandlersRef.current).forEach(([eventType]) => {
        eventSource.addEventListener(eventType, event => {
          try {
            const data = JSON.parse(event.data);
            // Always use ref to get latest handler (supports hot updates without reconnect)
            if (eventHandlersRef.current[eventType]) {
              eventHandlersRef.current[eventType](data);
            }
          } catch (error) {
            console.error(`[SSE] Error handling event "${eventType}":`, error);
          }
        });
      });
    } catch (error) {
      console.error('[SSE] Error creating EventSource:', error);
    }
  }, [url, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setEventSource(null);
    }

    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 100);
  }, [connect, disconnect]);

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (enabled) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected, // Return from state (reactive)
    eventSource, // Return from state instead of ref
    reconnect,
    disconnect,
  };
};

export default useSSE;
