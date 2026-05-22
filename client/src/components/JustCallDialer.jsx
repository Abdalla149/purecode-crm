import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialer } from '../context/DialerContext';
import api from '../utils/api';

/**
 * Invisible SDK host for agents.
 *
 * Before login:  shows a fullscreen modal so the agent can authenticate inside
 *                the JustCall iframe. The modal disappears the moment onLogin fires.
 *
 * After login:   the iframe container moves off-screen (still in DOM so postMessage
 *                continues to work) — zero visible UI. CALL NOW triggers calls directly.
 */
export default function JustCallDialer() {
  const { user } = useAuth();
  const ctx = useDialer();

  useEffect(() => {
    if (user?.role !== 'agent' || !ctx) return;
    let mounted = true;

    import('@justcall/justcall-dialer-sdk').then(({ JustCallDialer: SDK }) => {
      if (!mounted) return;

      const d = new SDK({
        dialerId: 'justcall-dialer',
        onLogin:  () => ctx.setIsLoggedIn(true),
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

  const isLoggedIn = ctx?.isLoggedIn ?? false;

  // ── After login: iframe moves completely off-screen ──
  if (isLoggedIn) {
    return (
      <div
        id="justcall-dialer"
        style={{
          position:  'fixed',
          top:       '-9999px',
          left:      '-9999px',
          width:     385,
          height:    665,
          overflow:  'hidden',
          pointerEvents: 'none',
        }}
      />
    );
  }

  // ── Before login: fullscreen modal with iframe centered ──
  return (
    <>
      {/* Dark backdrop */}
      <div style={{
        position:  'fixed',
        inset:     0,
        background: 'rgba(5, 8, 18, 0.92)',
        zIndex:    9998,
        display:   'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
      }}>
        <p style={{
          color:        'var(--text2)',
          fontSize:     14,
          fontWeight:   600,
          letterSpacing: '0.04em',
          marginBottom: 20,
          textAlign:    'center',
        }}>
          Log in to activate calling
        </p>

        {/* Iframe container — centered above backdrop */}
        <div
          id="justcall-dialer"
          style={{
            width:        385,
            height:       665,
            borderRadius: 12,
            overflow:     'hidden',
            border:       '1px solid var(--border)',
            background:   'var(--bg1)',
            zIndex:       9999,
            position:     'relative',
          }}
        />
      </div>
    </>
  );
}
