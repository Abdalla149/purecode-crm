import { useEffect } from 'react';
import { JustCallDialer as JustCallSDK } from '@justcall/justcall-dialer-sdk';
import { useDialer } from '../context/DialerContext';

export default function JustCallDialer() {
  const { panelOpen, togglePanel, _register, _setReady, _setLoggedIn } = useDialer();

  useEffect(() => {
    const dialer = new JustCallSDK({
      dialerId: 'jc-dialer-container',
      onReady: () => {
        _setReady(true);
        _register(dialer);
      },
      onLogin: (data) => {
        _setLoggedIn(true);
      },
      onLogout: () => {
        _setLoggedIn(false);
      },
    });

    return () => {
      try { dialer.destroy(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`jc-panel-wrap${panelOpen ? ' open' : ''}`}>
      {/* Vertical DIALER tab — always visible at right edge */}
      <button className="jc-tab" onClick={togglePanel} aria-label="Toggle dialer panel">
        <span>{panelOpen ? 'CLOSE' : 'DIALER'}</span>
      </button>

      {/* Panel body */}
      <div className="jc-panel">
        <div className="jc-panel-header">
          <div className="jc-panel-title">
            <span className="jc-panel-dot" />
            Dialer
          </div>
          <button className="jc-panel-close" onClick={togglePanel} aria-label="Close dialer">✕</button>
        </div>

        {/* SDK mounts its iframe here — never unmounted so session persists */}
        <div id="jc-dialer-container" className="jc-iframe-host" />
      </div>
    </div>
  );
}
