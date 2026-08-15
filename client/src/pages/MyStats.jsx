import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, Phone, Star, CalendarCheck, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function pct(num, denom) {
  if (!denom) return '0%';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)' }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 30, fontWeight: 700, color: accent || 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>}
    </div>
  );
}

export default function MyStats() {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get('/stats/me');
      setStats(data.stats);
    } catch {
      setError('Could not load your stats — try refreshing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const contacted = stats
    ? stats.called + stats.noAnswer + stats.voicemail + stats.callback +
      stats.interested + stats.demosBooked + stats.closed + stats.notQualified
    : 0;
  const remaining = stats ? stats.new + stats.callback : 0;

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-h1">My Stats</h1>
          <p className="page-subtitle">Your personal performance — {user?.name}</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={loading} style={{ gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.3)', color: '#ff4d6a', padding: '14px 18px', borderRadius: 10, marginTop: 8 }}>
          {error}
        </div>
      )}

      {!error && loading && !stats && (
        <div className="placeholder-wrap"><TrendingUp size={32} color="var(--text3)" /><div className="placeholder-title">Loading your stats…</div></div>
      )}

      {stats && (
        <>
          {/* Headline KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginTop: 8 }}>
            <StatCard icon={<Phone size={14} />}         label="Total leads"   value={stats.totalLeads} sub={`${remaining} still to call`} />
            <StatCard icon={<Phone size={14} />}         label="Contacted"     value={contacted} sub={pct(contacted, stats.totalLeads) + ' of your list'} />
            <StatCard icon={<Star size={14} />}          label="Interested"    value={stats.interested} sub={pct(stats.interested, contacted) + ' of contacted'} accent="var(--primary)" />
            <StatCard icon={<CalendarCheck size={14} />} label="Demos booked"  value={stats.demosBooked} sub={pct(stats.demosBooked, contacted) + ' demo rate'} accent="var(--purple)" />
            <StatCard icon={<Trophy size={14} />}        label="Closed"        value={stats.closed} sub={pct(stats.closed, contacted) + ' close rate'} accent="var(--gold)" />
          </div>

          {/* Outcome breakdown */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 18 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Outcome breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
              {[
                { label: 'New / uncalled', value: stats.new },
                { label: 'Callbacks',      value: stats.callback },
                { label: 'Called',         value: stats.called },
                { label: 'No answer',      value: stats.noAnswer },
                { label: 'Voicemail',      value: stats.voicemail },
                { label: 'Not qualified',  value: stats.notQualified },
              ].map(r => (
                <div key={r.label} style={{ padding: '10px 0' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700 }}>{r.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.label}</div>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>
            Talk-time metrics activate once your JustCall number is connected.
          </p>
        </>
      )}
    </div>
  );
}
