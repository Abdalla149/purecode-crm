import { createContext, useContext, useRef, useState } from 'react';

const DialerCtx = createContext(null);

function toE164(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10)                         return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export function DialerProvider({ children }) {
  const dialerRef     = useRef(null);
  const activeLeadRef = useRef(null);
  const [isReady,    setIsReady]    = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  function setDialer(d) {
    dialerRef.current = d;
  }

  /**
   * Returns:
   *   'dialed'        — SDK received the number, call is ringing
   *   'not-ready'     — SDK iframe not finished loading
   *   'not-logged-in' — agent hasn't authenticated in the dialer
   *   'no-phone'      — phone field is empty
   *   'error'         — SDK threw unexpectedly
   */
  function dialNumber(phone, lead = null) {
    const e164 = toE164(phone);
    if (!e164) return 'no-phone';
    if (!isReady)    return 'not-ready';
    if (!isLoggedIn) return 'not-logged-in';

    activeLeadRef.current = lead;
    try {
      dialerRef.current.dialNumber(e164);
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
