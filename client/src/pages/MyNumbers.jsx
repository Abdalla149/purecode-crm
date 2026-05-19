import { useState } from 'react';
import { Phone, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CALL_LIMIT = 30;

function loadCallCounts() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = JSON.parse(localStorage.getItem('purecode_call_counts') || 'null');
    if (raw?.date === today) return raw;
  } catch {}
  return { date: new Date().toISOString().split('T')[0], counts: {}, callsToday: 0 };
}

export default function MyNumbers() {
  const { user } = useAuth();
  const [callCounts] = useState(loadCallCounts);

  const phoneNumbers = user?.phoneNumbers || [];
  const totalToday   = callCounts.callsToday || 0;

  // Determine active number (first one under limit)
  const activeNumber = phoneNumbers.find(n => (callCounts.counts?.[n.id] || 0) < CALL_LIMIT)
    || phoneNumbers[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">My Numbers · {user?.name}</h1>
          <p className="page-subtitle">Phone rotation status — rotates every {CALL_LIMIT} calls</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="kpi-strip">
        <div className="kpi blue">
          <div className="kpi-label">📞 Calls Today</div>
          <div className="kpi-num">{totalToday}</div>
          <div className="kpi-delta flat">this session</div>
        </div>
        <div className="kpi green">
          <div className="kpi-label">Active Number</div>
          <div className="kpi-num" style={{ fontSize: 16, lineHeight: 1.3 }}>
            {activeNumber ? `#${phoneNumbers.findIndex(n => n.id === activeNumber.id) + 1}` : '—'}
          </div>
          <div className="kpi-delta flat">{activeNumber?.number || 'none'}</div>
        </div>
        <div className="kpi gold">
          <div className="kpi-label">Numbers Available</div>
          <div className="kpi-num">
            {phoneNumbers.filter(n => (callCounts.counts?.[n.id] || 0) < CALL_LIMIT).length}
          </div>
          <div className="kpi-delta flat">of {phoneNumbers.length}</div>
        </div>
      </div>

      {phoneNumbers.length === 0 ? (
        <div className="placeholder-wrap" style={{ marginTop: 8 }}>
          <Phone size={32} color="var(--text3)" />
          <div className="placeholder-title">No numbers assigned</div>
          <p className="placeholder-sub">Contact David to set up your phone numbers.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {phoneNumbers.map((num, i) => {
            const count   = callCounts.counts?.[num.id] || 0;
            const pct     = Math.min(100, Math.round((count / CALL_LIMIT) * 100));
            const isFull  = count >= CALL_LIMIT;
            const isActive = activeNumber?.id === num.id;

            return (
              <div key={num.id} className="panel" style={{
                borderColor: isActive ? 'rgba(0,229,160,0.3)' : 'var(--border)',
                background: isActive ? 'rgba(0,229,160,0.04)' : 'var(--bg2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  {/* Number circle */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: isActive ? 'var(--primary-dim)' : 'var(--bg3)',
                    border: `2px solid ${isActive ? 'var(--primary)' : 'var(--border2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14,
                    color: isActive ? 'var(--primary)' : 'var(--text2)',
                  }}>
                    #{i + 1}
                  </div>

                  {/* Number info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                        {num.number}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 10, color: 'var(--primary)', background: 'var(--primary-dim)', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
                          ACTIVE
                        </span>
                      )}
                      {isFull && (
                        <span style={{ fontSize: 10, color: 'var(--orange)', background: 'var(--orange-dim)', padding: '2px 8px', borderRadius: 100, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={9} /> ROTATED OUT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {num.label} · {isFull ? `${CALL_LIMIT}/${CALL_LIMIT} calls — at limit` : `${count} of ${CALL_LIMIT} calls used today`}
                    </div>
                  </div>

                  {/* Call count */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: isFull ? 'var(--orange)' : isActive ? 'var(--primary)' : 'var(--text2)', lineHeight: 1 }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>calls</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                    <span>Rotation progress</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3 }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 3,
                      background: isFull ? 'var(--orange)' : isActive ? 'var(--primary)' : 'var(--blue)',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                    {isFull
                      ? `Rotated out — all ${CALL_LIMIT} calls used. Resets tomorrow.`
                      : `${CALL_LIMIT - count} calls remaining before rotation`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 20, padding: '14px 18px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>How rotation works</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
          Numbers rotate automatically after every {CALL_LIMIT} outbound calls to avoid spam flags.<br />
          The system always picks the number with the fewest calls. Counts reset daily at midnight.
        </div>
      </div>
    </>
  );
}
