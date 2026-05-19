import { useState, useEffect } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import LeadPanel from '../components/LeadPanel';

const OUTCOME_STYLE = {
  'Interested':    { bg: 'rgba(0,229,160,0.12)',   color: 'var(--primary)' },
  'Demo Booked':   { bg: 'rgba(167,139,250,0.12)', color: 'var(--purple)' },
  'Closed':        { bg: 'rgba(245,200,66,0.15)',  color: 'var(--gold)' },
  'Callback':      { bg: 'rgba(245,200,66,0.12)',  color: 'var(--gold)' },
  'Called':        { bg: 'rgba(138,135,128,0.12)', color: 'var(--text2)' },
  'No Answer':     { bg: 'rgba(74,72,69,0.25)',    color: 'var(--text3)' },
  'Voicemail':     { bg: 'rgba(74,72,69,0.25)',    color: 'var(--text3)' },
  'Not Qualified': { bg: 'rgba(255,77,106,0.12)',  color: 'var(--red)' },
};

function OutcomeBadge({ outcome }) {
  const s = OUTCOME_STYLE[outcome] || { bg: 'var(--bg4)', color: 'var(--text2)' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {outcome}
    </span>
  );
}

export default function MyActivity() {
  const { user }          = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [selected, setSelected] = useState(null);

  async function fetchActivity() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/leads');
      // All leads touched = any status other than 'New'
      const touched = (data.leads || []).filter(l => l.status && l.status !== 'New');
      // Group by outcome for display — most impactful first
      const priority = { 'Demo Booked': 0, 'Closed': 1, 'Interested': 2, 'Callback': 3, 'Called': 4, 'No Answer': 5, 'Voicemail': 6, 'Not Qualified': 7 };
      touched.sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9));
      setLeads(touched);
    } catch {
      setError('Could not load activity — try refreshing');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchActivity(); }, []);

  const outcomeGroups = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--text3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading activity…
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
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l).filter(l => l.status !== 'New'));
            setSelected(null);
          }}
        />
      )}

      <div className="page-head">
        <div>
          <h1 className="page-h1">My Activity · {user?.name}</h1>
          <p className="page-subtitle">
            {leads.length === 0 ? 'No activity yet' : `${leads.length} lead${leads.length !== 1 ? 's' : ''} contacted`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchActivity}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Outcome breakdown strip */}
      {leads.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(outcomeGroups).map(([outcome, count]) => (
            <div key={outcome} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <OutcomeBadge outcome={outcome} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {leads.length === 0 ? (
        <div className="placeholder-wrap" style={{ marginTop: 8 }}>
          <Activity size={32} color="var(--text3)" />
          <div className="placeholder-title">No activity yet</div>
          <p className="placeholder-sub">
            Start calling leads and your outcomes will appear here.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-head" style={{ padding: '14px 18px 0' }}>
            <div className="panel-title">Contacted Leads</div>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
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
                  <th>Outcome</th>
                  <th>Hook</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => (
                  <tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(lead)}>
                    <td className="td-mono" style={{ color: 'var(--text3)' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="td-name">{lead.name}</td>
                    <td className="td-phone">{lead.phone || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.city || '—'}</td>
                    <td><OutcomeBadge outcome={lead.status} /></td>
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
