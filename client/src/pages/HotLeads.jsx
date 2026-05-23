import { useState, useEffect, useMemo } from 'react';
import { Flame, Phone, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebarCounts } from '../context/SidebarCounts';
import api from '../utils/api';
import InCallOverlay from '../components/InCallOverlay';
import LeadPanel from '../components/LeadPanel';
import { useCallQueue } from '../hooks/useCallQueue';
import { formatGoogleScore, toE164 } from '../utils/leads';

function StatusBadge({ status }) {
  const map = {
    'Interested':  'badge-interested',
    'Demo Booked': 'badge-demo',
    'Callback':    'badge-called',
    'New':         'badge-new',
  };
  return <span className={`badge-status ${map[status] || 'badge-new'}`}>{status}</span>;
}

export default function HotLeads() {
  const { user }          = useAuth();
  const { setCounts }     = useSidebarCounts();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const {
    activeCall, saving,
    handleStartCall, handleOutcome,
    dialWarning,
  } = useCallQueue();

  async function fetchLeads() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/leads');
      setLeads(data.leads || []);
    } catch {
      setError('Could not load leads — try refreshing');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeads(); }, []);

  // Hot = Interested + Demo Booked + tier 1
  const hotLeads = useMemo(() =>
    leads
      .filter(l =>
        l.status === 'Interested' ||
        l.status === 'Demo Booked' ||
        String(l.tier) === '1'
      )
      .sort((a, b) => {
        const pri = { 'Demo Booked': 0, 'Interested': 1 };
        const ap = pri[a.status] ?? 2;
        const bp = pri[b.status] ?? 2;
        if (ap !== bp) return ap - bp;
        return (Number(a.tier) || 9) - (Number(b.tier) || 9);
      }),
    [leads]
  );

  useEffect(() => {
    setCounts(prev => ({ ...prev, '/hot-leads': hotLeads.length }));
  }, [hotLeads.length, setCounts]);

  function onCallOutcome(leadId, status) {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status, lastOutcome: status } : l
    ));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--text3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading hot leads…
      </div>
    );
  }

  return (
    <>
      {activeCall && (
        <InCallOverlay
          lead={activeCall.lead}
          agentName={user?.name || 'Agent'}
          onOutcome={(outcome, note) => handleOutcome(outcome, note, onCallOutcome)}
          saving={saving}
        />
      )}

      {selectedLead && !activeCall && (
        <LeadPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusUpdate={(id, status) => {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status, lastOutcome: status } : l));
            setSelectedLead(null);
          }}
        />
      )}

      {dialWarning && (
        <div style={{
          background:   'rgba(245,158,11,0.12)',
          border:       '1px solid rgba(245,158,11,0.35)',
          borderRadius: 8,
          padding:      '10px 16px',
          color:        'var(--gold)',
          fontSize:     13,
          fontWeight:   600,
          marginBottom: 12,
          display:      'flex',
          alignItems:   'center',
          gap:          8,
        }}>
          <Phone size={14} />
          {dialWarning}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1 className="page-h1">Hot Leads · {user?.name}</h1>
          <p className="page-subtitle">
            {hotLeads.length === 0
              ? 'No hot leads right now'
              : `${hotLeads.length} high-priority lead${hotLeads.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLeads}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="kpi-strip">
        <div className="kpi green">
          <div className="kpi-label">Interested</div>
          <div className="kpi-num">{hotLeads.filter(l => l.status === 'Interested').length}</div>
          <div className="kpi-delta flat">warm</div>
        </div>
        <div className="kpi purple">
          <div className="kpi-label">Demo Booked</div>
          <div className="kpi-num">{hotLeads.filter(l => l.status === 'Demo Booked').length}</div>
          <div className="kpi-delta flat">scheduled</div>
        </div>
        <div className="kpi blue">
          <div className="kpi-label">Total Hot</div>
          <div className="kpi-num">{hotLeads.length}</div>
          <div className="kpi-delta flat">priority</div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {hotLeads.length === 0 ? (
        <div className="placeholder-wrap" style={{ marginTop: 8 }}>
          <Flame size={32} color="var(--text3)" />
          <div className="placeholder-title">No hot leads yet</div>
          <p className="placeholder-sub">
            Leads marked Interested or Demo Booked will appear here.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-head" style={{ padding: '14px 18px 0' }}>
            <div className="panel-title">Priority Leads</div>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
              Demo Booked → Interested
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
                  <th>Status</th>
                  <th>Hook</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {hotLeads.map((lead, idx) => {
                  const gScore = formatGoogleScore(lead.googleScore);
                  const hook   = lead.hookNote || '';
                  return (
                    <tr
                      key={lead.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="td-mono" style={{ color: 'var(--text3)' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="td-name">{lead.name}</td>
                      <td className="td-phone">
                        {lead.phone
                          ? <a href={`tel:${toE164(lead.phone)}`} onClick={e => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'none' }}>{lead.phone}</a>
                          : '—'}
                      </td>
                      <td>{lead.city || '—'}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                        {gScore || <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
                      </td>
                      <td><StatusBadge status={lead.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', maxWidth: 200 }}>
                        {hook
                          ? <span title={hook}>{hook.length > 45 ? hook.slice(0, 45) + '…' : hook}</span>
                          : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                          <a
                            href={lead.phone ? `tel:${toE164(lead.phone)}` : undefined}
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '4px 10px', gap: 4, textDecoration: 'none', pointerEvents: lead.phone ? 'auto' : 'none', opacity: lead.phone ? 1 : 0.4 }}
                            onClick={e => { e.preventDefault(); handleStartCall(lead); }}
                          >
                            <Phone size={11} /> Call Now
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
