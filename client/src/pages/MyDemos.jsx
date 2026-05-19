import { useState, useEffect } from 'react';
import { Star, RefreshCw, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import LeadPanel from '../components/LeadPanel';
import { formatGoogleScore } from '../utils/leads';

export default function MyDemos() {
  const { user }          = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [selected, setSelected] = useState(null);

  async function fetchDemos() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/leads', { params: { status: 'Demo Booked' } });
      setLeads(data.leads || []);
    } catch {
      setError('Could not load demos — try refreshing');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDemos(); }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--text3)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading demos…
      </div>
    );
  }

  return (
    <>
      {selected && (
        <LeadPanel
          lead={selected}
          onClose={() => setSelected(null)}
          onStatusUpdate={(id, status) => {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
            setSelected(null);
          }}
        />
      )}

      <div className="page-head">
        <div>
          <h1 className="page-h1">My Demos · {user?.name}</h1>
          <p className="page-subtitle">
            {leads.length === 0 ? 'No demos booked yet' : `${leads.length} demo${leads.length !== 1 ? 's' : ''} scheduled`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchDemos}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        <div className="kpi purple">
          <div className="kpi-label">⭐ Demos Booked</div>
          <div className="kpi-num">{leads.length}</div>
          <div className="kpi-delta flat">total</div>
        </div>
        <div className="kpi green">
          <div className="kpi-label">Avg Google Score</div>
          <div className="kpi-num" style={{ fontSize: 20 }}>
            {(() => {
              const scores = leads
                .map(l => parseFloat((l.googleScore || '').split('|')[0]))
                .filter(n => !isNaN(n));
              return scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
            })()}
          </div>
          <div className="kpi-delta flat">avg rating</div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {leads.length === 0 ? (
        <div className="placeholder-wrap" style={{ marginTop: 8 }}>
          <Star size={40} color="var(--purple)" strokeWidth={1.5} />
          <div className="placeholder-title" style={{ color: 'var(--purple)' }}>🎉 No demos yet — keep pushing!</div>
          <p className="placeholder-sub">
            Every "Interested" is a step away. When you book one it shows up here.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-head" style={{ padding: '14px 18px 0' }}>
            <div className="panel-title">Booked Demos</div>
            <span style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 600 }}>
              {leads.length} total
            </span>
          </div>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0, background: 'transparent' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Business</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Google</th>
                  <th>Hook</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => (
                  <tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(lead)}>
                    <td className="td-mono" style={{ color: 'var(--purple)' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="td-name">{lead.name}</td>
                    <td className="td-phone">{lead.phone || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.city || '—'}</td>
                    <td style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatGoogleScore(lead.googleScore) || <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', maxWidth: 200 }}>
                      {lead.hookNote
                        ? <span title={lead.hookNote}>{lead.hookNote.length > 45 ? lead.hookNote.slice(0, 45) + '…' : lead.hookNote}</span>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
