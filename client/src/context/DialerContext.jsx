import { createContext, useContext, useState, useRef } from 'react';

const DialerContext = createContext(null);

export function DialerProvider({ children }) {
  const [panelOpen,  setPanelOpen]  = useState(() => localStorage.getItem('jc_panel_open') === 'true');
  const [isReady,    setIsReady]    = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('jc_logged_in') === 'true');
  const dialerRef = useRef(null);

  function openPanel() {
    setPanelOpen(true);
    localStorage.setItem('jc_panel_open', 'true');
  }

  function closePanel() {
    setPanelOpen(false);
    localStorage.setItem('jc_panel_open', 'false');
  }

  function togglePanel() {
    setPanelOpen(p => {
      const next = !p;
      localStorage.setItem('jc_panel_open', String(next));
      return next;
    });
  }

  async function dialNumber(phone) {
    if (!phone) return 'no-phone';
    if (!dialerRef.current) return 'not-ready';

    openPanel();

    try {
      await dialerRef.current.ready();
      dialerRef.current.dialNumber(phone);
      return 'dialed';
    } catch {
      return 'error';
    }
  }

  return (
    <DialerContext.Provider value={{
      panelOpen, isReady, isLoggedIn,
      openPanel, closePanel, togglePanel,
      dialNumber,
      // Used only by JustCallDialer to register the SDK instance + state setters
      _register:      (instance) => { dialerRef.current = instance; },
      _setReady:      setIsReady,
      _setLoggedIn:   (v) => {
        setIsLoggedIn(v);
        if (v) localStorage.setItem('jc_logged_in', 'true');
        else   localStorage.removeItem('jc_logged_in');
      },
    }}>
      {children}
    </DialerContext.Provider>
  );
}

export function useDialer() {
  return useContext(DialerContext);
}
