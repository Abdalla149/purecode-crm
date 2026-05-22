import { useEffect, useState } from 'react';
import { Phone, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDialer } from '../context/DialerContext';
import api from '../utils/api';

export default function JustCallDialer() {
  const { user } = useAuth();
  const ctx = useDialer();
  const [open, setOpen] = useState(false);

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
            duration: payload?.duration  || 0,
            callSid:  payload?.call_sid  || '',
          });
        } catch {
          // Non-critical — agent files outcome separately
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

  return (
    <div style={{
      position:   'fixed',
      top:        '50%',
      right:      0,
      transform:  `translateY(-50%) translateX(${open ? '0px' : '385px'})`,
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      display:    'flex',
      zIndex:     1000,
    }}>
      {/* ── Toggle tab ── */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          width:          36,
          height:         120,
          background:     'var(--bg2)',
          border:         '1px solid var(--border)',
          borderRight:    'none',
          borderRadius:   '8px 0 0 8px',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          cursor:         'pointer',
          gap:            6,
          flexShrink:     0,
          userSelect:     'none',
        }}
      >
        <div style={{
          width:        8,
          height:       8,
          borderRadius: '50%',
          background:   isLoggedIn ? 'var(--primary)' : 'var(--text3)',
          flexShrink:   0,
        }} />
        <span style={{
          writingMode:     'vertical-rl',
          textOrientation: 'mixed',
          transform:       'rotate(180deg)',
          fontSize:        10,
          fontWeight:      700,
          letterSpacing:   '0.12em',
          color:           'var(--text2)',
          fontFamily:      "'DM Mono', monospace",
        }}>
          DIALER
        </span>
        <ChevronRight
          size={12}
          color="var(--text3)"
          style={{
            transform:  open ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s',
          }}
        />
      </div>

      {/* ── Dialer panel ── */}
      <div style={{
        width:      385,
        height:     665,
        background: 'var(--bg1)',
        border:     '1px solid var(--border)',
        borderRight: 'none',
        position:   'relative',
        overflow:   'hidden',
        flexShrink: 0,
      }}>
        {/* SDK injects its iframe here */}
        <div id="justcall-dialer" style={{ width: '100%', height: '100%' }} />

        {/* Login overlay — shown until agent authenticates in the iframe */}
        {!isLoggedIn && (
          <div style={{
            position:       'absolute',
            inset:          0,
            background:     'rgba(10, 14, 26, 0.88)',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            12,
            pointerEvents:  'none',
          }}>
            <Phone size={28} color="var(--text3)" />
            <p style={{
              color:     'var(--text2)',
              fontSize:  13,
              textAlign: 'center',
              margin:    0,
              padding:   '0 24px',
            }}>
              Log in to start calling
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
