import { useState } from 'react';
import { Phone, RefreshCw, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function loadActiveIndex(phoneNumbers) {
  try {
    const stored = localStorage.getItem('purecode_active_number_idx');
    const idx = parseInt(stored, 10);
    if (!isNaN(idx) && idx >= 0 && idx < phoneNumbers.length) return idx;
  } catch {}
  return 0;
}

export default function MyNumbers() {
  const { user } = useAuth();
  const phoneNumbers = user?.phoneNumbers || [];

  const [activeIdx, setActiveIdx]     = useState(() => loadActiveIndex(phoneNumbers));
  const [confirmed, setConfirmed]     = useState(false);

  const activeNumber = phoneNumbers[activeIdx] || null;

  function switchNumber() {
    const nextIdx = (activeIdx + 1) % phoneNumbers.length;
    setActiveIdx(nextIdx);
    localStorage.setItem('purecode_active_number_idx', String(nextIdx));
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 3000);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">My Numbers · {user?.name}</h1>
          <p className="page-subtitle">Manage your active outbound number</p>
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
            const isActive = i === activeIdx;
            return (
              <div key={num.id} className="panel" style={{
                borderColor: isActive ? 'rgba(0,229,160,0.3)' : 'var(--border)',
                background:  isActive ? 'rgba(0,229,160,0.04)' : 'var(--bg2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {num.label}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Switch Number button */}
          {phoneNumbers.length > 1 && (
            <div style={{ marginTop: 8 }}>
              {confirmed ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px 24px', borderRadius: 8,
                  background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.3)',
                  color: 'var(--primary)', fontWeight: 600, fontSize: 14,
                }}>
                  <CheckCircle size={16} />
                  Switched to #{activeIdx + 1} — {activeNumber?.number}
                </div>
              ) : (
                <button
                  onClick={switchNumber}
                  style={{
                    width: '100%', padding: '14px 24px', borderRadius: 8,
                    background: 'var(--primary)', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    color: '#000', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
                    letterSpacing: '0.02em',
                  }}
                >
                  <RefreshCw size={15} />
                  Switch Number
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
