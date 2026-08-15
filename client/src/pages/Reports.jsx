import { useState, useEffect, useCallback } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import api from '../utils/api';

function pct(num, denom) {
  if (!denom) return '0%';
  return `${((num / denom) * 100).toFixed(1)}%`;
}
function money(n) {
  return '$' + (n || 0).toLocaleString('en-US');
}
function contactedOf(s) {
  return s.called + s.noAnswer + s.voicemail + s.callback +
         s.interested + s.demosBooked + s.closed + s.notQualified;
}

function KpiCard({ label, value, accent }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 700, color: accent || 'var(--text)', marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default function Reports() {
  const [team, setTeam]     = useState(null);
  const [conv, setConv]     = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [t, c, a] = await Promise.all([
        api.get('/stats/team'),
        api.get('/stats/conversion'),
        api.get('/stats/agents'),
      ]);
      setTeam(t.data.stats);
      setConv(c.data);
      setAgents(a.data.agents || []);
    } catch {
      setError('Could not load reports — try refreshing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxDay = conv ? Math.max(1, ...conv.days.map(d => d.count)) : 1;

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-h1">Reports</h1>
          <p className="page-subtitle">Team performance, conversion, and pipeline</p>
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

      {!error && loading && !team && (
        <div className="placeholder-wrap"><BarChart2 size={32} color="var(--text3)" /><div className="placeholder-title">Loading reports…</div></div>
      )}

      {team && (
        <>
          {/* Team KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginTop: 8 }}>
            <KpiCard label="Total leads"    value={team.totalLeads} />
            <KpiCard label="Contacted"      value={contactedOf(team)} />
            <KpiCard label="Interested"     value={team.interested}  accent="var(--primary)" />
            <KpiCard label="Demos booked"   value={team.demosBooked} accent="var(--purple)" />
            <KpiCard label="Closed"         value={team.closed}      accent="var(--gold)" />
            <KpiCard label="Pipeline value" value={money(team.pipelineValue)} accent="var(--primary)" />
          </div>

          {/* 7-day demo trend */}
          {conv && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15 }}>Demos booked — last 7 days</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Conversion: <b style={{ color: 'var(--primary)' }}>{conv.conversionRate}%</b></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
                {conv.days.map(d => (
                  <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--text3)' }}>{d.count}</div>
                    <div style={{ width: '100%', height: `${(d.count / maxDay) * 90}px`, minHeight: 3, background: 'var(--purple)', borderRadius: 4, opacity: d.count ? 1 : 0.25 }} />
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{d.day}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-agent table */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 18, overflowX: 'auto' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>By agent</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {['Agent', 'Total', 'Contacted', 'Interested', 'Demos', 'Closed', 'Close rate'].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map(a => {
                  const contacted = contactedOf(a);
                  return (
                    <tr key={a.id}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        {a.name}{a.isActive && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--primary)' }}>● on call</span>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{a.totalLeads}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{contacted}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--primary)' }}>{a.interested}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--purple)' }}>{a.demosBooked}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--gold)' }}>{a.closed}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{pct(a.closed, contacted)}</td>
                    </tr>
                  );
                })}
                {agents.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center', color: 'var(--text3)' }}>No agent data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12 }}>
            Pipeline value estimates Interested ×$500 + Demos ×$2,500 + Closed ×$4,500.
          </p>
        </>
      )}
    </div>
  );
}
