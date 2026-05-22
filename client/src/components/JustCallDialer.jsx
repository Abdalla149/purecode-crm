import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialer } from '../context/DialerContext';
import api from '../utils/api';

function loginFlagKey(name) {
  return `justcall_logged_in_${(name || '').toLowerCase()}`;
}

/**
 * Invisible SDK host.
 *
 * The <div id="justcall-dialer"> is ALWAYS rendered in the same tree position
 * so the SDK iframe is never unmounted.  Its CSS switches between two states:
 *
 *   showModal = true  → centered on screen inside a fullscreen backdrop
 *                       (one-time only, lets agent log in)
 *   showModal = false → position:fixed at (-10000px, -10000px), opacity:0,
 *                       pointer-events:none — fully hidden, fully functional
 *
 * Once onLogin fires the flag is written to localStorage and showModal never
 * flips back to true for this agent on this browser.
 */
export default function JustCallDialer() {
  const { user } = useAuth();
  const ctx = useDialer();

  const [showModal, setShowModal] = useState(() => {
    if (typeof window === 'undefined' || !user?.name) return false;
    return !localStorage.getItem(loginFlagKey(user.name));
  });

  useEffect(() => {
    if (user?.role !== 'agent' || !ctx) return;
    let mounted = true;

    import('@justcall/justcall-dialer-sdk').then(({ JustCallDialer: SDK }) => {
      if (!mounted) return;

      const d = new SDK({
        dialerId: 'justcall-dialer',
        onLogin: () => {
          ctx.setIsLoggedIn(true);
          try { localStorage.setItem(loginFlagKey(user.name), 'true'); } catch {}
          setShowModal(false);
        },
        onLogout: () => ctx.setIsLoggedIn(false),
        onReady:  () => ctx.setIsReady(true),
      });

      d.on('call-ended', async (payload) => {
        const lead = ctx.activeLeadRef?.current;
        if (!lead) return;
        try {
          await api.post('/calls/log', {
            leadId:   lead.id,
            duration: payload?.duration || 0,
            callSid:  payload?.call_sid || '',
          });
        } catch {
          // Non-critical — agent files outcome via overlay
        }
        ctx.activeLeadRef.current = null;
      });

      ctx.setDialer(d);
    }).catch(() => {});

    return () => {
      mounted = false;
      ctx.setDialer(null);
    };
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  if (user?.role !== 'agent') return null;

  return (
    <>
      {/* ── One-time login backdrop (shown until agent logs in) ── */}
      {showModal && (
        <div style={{
          position:       'fixed',
          inset:          0,
          background:     'rgba(5, 8, 18, 0.93)',
          zIndex:         9997,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            12,
          pointerEvents:  'none',   // clicks pass through to the iframe below
        }}>
          <p style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700, margin: 0 }}>
            Activate calling
          </p>
          <p style={{ color: 'var(--text3)', fontSize: 13, margin: 0, textAlign: 'center', maxWidth: 340 }}>
            Log in once to enable one-click calling. This screen won't appear again.
          </p>
        </div>
      )}

      {/*
        ── SDK iframe container ──
        Always rendered in the same tree position so the iframe is never destroyed.

        showModal=true  → visible, centered, zIndex above backdrop
        showModal=false → fixed at (-10000px, -10000px), opacity 0, no pointer events
                          but STILL IN DOM — SDK postMessage works normally
      */}
      <div
        id="justcall-dialer"
        style={showModal ? {
          position:     'fixed',
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -50%)',
          width:        385,
          height:       665,
          zIndex:       9998,
          overflow:     'hidden',
          borderRadius: 12,
          border:       '1px solid rgba(255,255,255,0.08)',
          background:   'var(--bg1)',
          pointerEvents: 'auto',
        } : {
          position:      'fixed',
          left:          -10000,
          top:           -10000,
          width:         385,
          height:        665,
          opacity:       0,
          pointerEvents: 'none',
          overflow:      'hidden',
        }}
      />
    </>
  );
}
