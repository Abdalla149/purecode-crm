import { createContext, useContext, useRef, useState } from 'react';

const DialerCtx = createContext(null);

export function DialerProvider({ children }) {
  const dialerRef     = useRef(null);
  const activeLeadRef = useRef(null);
  const [isReady,    setIsReady]    = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [panelOpen,  setPanelOpen]  = useState(false);

  function setDialer(d) {
    dialerRef.current = d;
  }

  function openPanel() {
    setPanelOpen(true);
  }

  /**
   * Returns:
   *   'dialed'         — call sent to SDK successfully
   *   'not-ready'      — SDK iframe not loaded yet
   *   'not-logged-in'  — agent not authenticated in dialer
   *   'no-phone'       — phone number is empty
   *   'error'          — SDK threw unexpectedly
   */
  function dialNumber(phone, lead = null) {
    if (!phone) return 'no-phone';

    if (!isReady) {
      setPanelOpen(true);
      return 'not-ready';
    }
    if (!isLoggedIn) {
      setPanelOpen(true);
      return 'not-logged-in';
    }

    activeLeadRef.current = lead;
    try {
      dialerRef.current.dialNumber(phone);
      return 'dialed';
    } catch {
      return 'error';
    }
  }

  return (
    <DialerCtx.Provider value={{
      dialerRef,
      activeLeadRef,
      isReady,    setIsReady,
      isLoggedIn, setIsLoggedIn,
      panelOpen,  setPanelOpen,
      openPanel,
      setDialer,
      dialNumber,
    }}>
      {children}
    </DialerCtx.Provider>
  );
}

export function useDialer() {
  return useContext(DialerCtx);
}
