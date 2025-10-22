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
  const isConnectedRef = useRef(false);
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

    console.log('[SSE] Connecting to:', url);

    try {
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;
      setEventSource(eventSource); // Update state to trigger re-render

      // Handle connection open
      eventSource.onopen = () => {
        console.log('[SSE] Connection opened');
        isConnectedRef.current = true;
      };

      // Handle initial connection event
      eventSource.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Received data:', data);

          if (data.type === 'connected') {
            console.log('[SSE] Connected with userId:', data.userId);
          }
        } catch (error) {
          console.error('[SSE] Error parsing message:', error);
        }
      };

      // Handle errors
      eventSource.onerror = error => {
        console.error('[SSE] Connection error:', error);
        isConnectedRef.current = false;

        // Close and attempt reconnect
        eventSource.close();
        eventSourceRef.current = null;
        setEventSource(null); // Clear state

        // Reconnect after 3 seconds
        if (enabled) {
          console.log('[SSE] Reconnecting in 3 seconds...');
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
            console.log(`[SSE] Event "${eventType}":`, data);
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
    console.log('[SSE] Disconnecting...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setEventSource(null); // Clear state
    }

    isConnectedRef.current = false;
  }, []);

  const reconnect = useCallback(() => {
    console.log('[SSE] Manual reconnect requested');
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
    isConnected: isConnectedRef.current,
    eventSource, // Return from state instead of ref
    reconnect,
    disconnect,
  };
};

export default useSSE;
