import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const RealtimeFeedContext = createContext({
  liveEvents: [],
  connected:  false,
});

export function useRealtimeFeed() {
  return useContext(RealtimeFeedContext);
}

// Ask for browser notification permission once.
// Returns true if granted.
async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showBrowserNotif(entry) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(`🔥 Demo Booked — ${entry.agentName}`, {
      body: `${entry.agentName} just booked a demo with ${entry.business}`,
      icon: '/favicon.ico',
      tag:  entry.id, // dedupe: same id won't stack
    });
  } catch {
    // Some browsers restrict notifications in certain contexts — ignore silently
  }
}

export function RealtimeFeedProvider({ children }) {
  const { token, user }     = useAuth();
  const [liveEvents, setLiveEvents] = useState([]);
  const [connected, setConnected]   = useState(false);
  const esRef        = useRef(null);
  const retryTimer   = useRef(null);
  const retryCount   = useRef(0);
  const notifAsked   = useRef(false);

  const connect = useCallback(() => {
    if (!token) return;

    // Request notification permission once after first user interaction
    if (!notifAsked.current) {
      notifAsked.current = true;
      requestNotifPermission();
    }

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const url = `${API_BASE}/feed/stream?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      retryCount.current = 0;
    });

    es.addEventListener('activity', (e) => {
      try {
        const entry = JSON.parse(e.data);
        setLiveEvents(prev => {
          // Dedupe by id
          if (prev.some(x => x.id === entry.id)) return prev;
          return [entry, ...prev].slice(0, 100);
        });
        // Browser notification for Demo Booked — agents see others' wins
        if (entry.outcome === 'Demo Booked') {
          // Don't notify yourself
          if (entry.agentName !== user?.name) {
            showBrowserNotif(entry);
          }
        }
      } catch {
        // malformed event — ignore
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setConnected(false);

      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
      retryCount.current += 1;
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [token, user?.name]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      clearTimeout(retryTimer.current);
    };
  }, [connect]);

  return (
    <RealtimeFeedContext.Provider value={{ liveEvents, connected }}>
      {children}
    </RealtimeFeedContext.Provider>
  );
}
