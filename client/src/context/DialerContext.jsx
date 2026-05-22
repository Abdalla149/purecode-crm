import { createContext, useContext, useRef, useState } from 'react';

const DialerCtx = createContext(null);

export function DialerProvider({ children }) {
  const dialerRef     = useRef(null);
  const activeLeadRef = useRef(null);
  const [isReady,    setIsReady]    = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  function setDialer(d) {
    dialerRef.current = d;
  }

  function dialNumber(phone, lead = null) {
    activeLeadRef.current = lead;
    if (dialerRef.current && phone) {
      dialerRef.current.dialNumber(phone);
    }
  }

  return (
    <DialerCtx.Provider value={{
      dialerRef,
      activeLeadRef,
      isReady,    setIsReady,
      isLoggedIn, setIsLoggedIn,
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
