import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Phone, RefreshCw, CheckCheck, Calendar, Mail, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebarCounts } from '../context/SidebarCounts';
import api from '../utils/api';
import CallWorkspace from '../components/CallWorkspace';
import LeadPanel from '../components/LeadPanel';
import WelcomeEmailPanel from '../components/WelcomeEmailPanel';
import FollowUpEmailPanel from '../components/FollowUpEmailPanel';
import NextActionBadge from '../components/NextActionBadge';
import { useCallQueue } from '../hooks/useCallQueue';
import { formatGoogleScore } from '../utils/leads';

function StatusBadge({ status }) {
  const map = {
    'Callback':   'badge-called',
    'Interested': 'badge-interested',
    'Demo Booked':'badge-demo',
  };
  return <span className={`badge-status ${map[status] || 'badge-new'}`}>{status}</span>;
}

export default function Callbacks() {
  const { user }            = useAuth();
  const { setCounts }       = useSidebarCounts();
  const [leads, setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [leadNotes, setLeadNotes] = useState({});     // { leadId: [notes] }
  const [selectedLead, setSelectedLead] = useState(null);
  const [welcomeLead,  setWelcomeLead]  = useState(null);
  const [followUpLead, setFollowUpLead] = useState(null);
  const [toast, setToast]               = useState(null);
  const toastTimer = useRef(null);

  const {
    activeCall, saving,
    handleStartCall, handleOutcome,
    dialWarning,
  } = useCallQueue();

  // ── Fetch leads ────────────────────────────────────────────
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

  // ── Filter: Callback or Interested ─────────────────────────
  const callbackLeads = useMemo(() =>
    leads
      .filter(l => l.status === 'Callback' || l.status === 'Interested')
      .sort((a, b) => {
        // Callback first, then Interested; within each group by dateUpdated desc
        if (a.status !== b.status) {
          return a.status === 'Callback' ? -1 : 1;
        }
        return new Date(b.lastActivity || b.dateAdded || 0) - new Date(a.lastActivity || a.dateAdded || 0);
      }),
    [leads]
  );

  // ── Set sidebar count badge ────────────────────────────────
  useEffect(() => {
    setCounts(prev => ({ ...prev, '/callbacks': callbackLeads.length }));
  }, [callbackLeads.length, setCounts]);

  // ── Lazily fetch notes for callback leads ──────────────────
  useEffect(() => {
    if (callbackLeads.length === 0) return;
    const toFetch = callbackLeads.slice(0, 25);
    toFetch.forEach(lead => {
      if (leadNotes[lead.id] !== undefined) return; // already loaded
      setLeadNotes(prev => ({ ...prev, [lead.id]: null })); // mark as loading
      api.get(`/leads/${lead.id}`)
        .then(({ data }) => {
          setLeadNotes(prev => ({ ...prev, [lead.id]: data.notes || [] }));
        })
        .catch(() => {
          setLeadNotes(prev => ({ ...prev, [lead.id]: [] }));
        });
    });
  }, [callbackLeads.length]); // eslint-disable-line

  function getCallbackNote(leadId) {
    const notes = leadNotes[leadId];
    if (notes === undefined) return <span style={{ color: 'var(--text3)' }}>—</span>;
    if (notes === null) return <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Loading…</span>;
    if (notes.length === 0) return <span style={{ color: 'var(--text3)' }}>No notes</span>;
    // Find the most recent callback/interested note
    const match = notes.find(n =>
      n.text.toLowerCase().includes('callback') ||
      n.text.toLowerCase().includes('interested')
    ) || notes[0];
    const clean = match.text.replace(/^\[.*?\]\s*by\s*.*?:\s*/i, '').trim();
    return (
      <span title={clean} style={{ fontSize: 12 }}>
        {clean.length > 55 ? clean.slice(0, 55) + '…' : clean || '—'}
      </span>
    );
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function onWelcomeSent(leadId) {
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, status: 'Interested', tags: [...(l.tags || []), 'welcome-email-sent'] }
        : l
    ));
    showToast('Welcome email sent — lead moved to Interested');
    setWelcomeLead(null);
  }

  function onFollowUpSent() {
    showToast('Follow-up email logged — Zoho send wiring coming in Phase 3');
    setFollowUpLead(null);
  }

  function handleNextAction(action, lead) {
    if (action === 'welcome')   { setWelcomeLead(lead);  return; }
    if (action === 'followup')  { setFollowUpLead(lead); return; }
    if (action === 'demo-prep') { showToast('Demo prep checklist coming soon'); return; }
    if (action === 'notify')    { showToast('David has been notified'); return; }
  }

  // ── Mark Done — moves back to queue as "Called" ────────────
  async function handleMarkDone(lead) {
    try {
      await api.post(`/leads/${lead.id}/note`, {
        text: '',
        outcome: 'Called',
      });
      setLeads(prev => prev.map(l =>
        l.id === lead.id ? { ...l, status: 'Called', lastOutcome: 'Called' } : l
      ));
    } catch {}
  }

  // ── Outcome from InCallOverlay ─────────────────────────────
  function onCallOutcome(leadId, status) {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status, lastOutcome: status } : l
    ));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--text3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading callbacks…
      </div>
    );
  }

  if (activeCall) {
    return (
      <CallWorkspace
        lead={activeCall.lead}
        agentName={user?.name || 'Agent'}
        onOutcome={(outcome, note) => handleOutcome(outcome, note, onCallOutcome)}
        saving={saving}
        queueStats={null}
        nextLeads={callbackLeads.slice(callbackLeads.findIndex(l => l.id === activeCall.lead.id) + 1).slice(0, 3)}
      />
    );
  }

  return (
    <>
      {toast && <div className="toast-notification">{toast}</div>}

      {selectedLead && (
        <LeadPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusUpdate={(id, status) => {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status, lastOutcome: status } : l));
            setSelectedLead(null);
          }}
        />
      )}
      {welcomeLead && (
        <WelcomeEmailPanel lead={welcomeLead} onClose={() => setWelcomeLead(null)} onSent={onWelcomeSent} />
      )}
      {followUpLead && (
        <FollowUpEmailPanel lead={followUpLead} onClose={() => setFollowUpLead(null)} onSent={onFollowUpSent} />
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

      {/* ── Page header ── */}
      <div className="page-head">
        <div>
          <h1 className="page-h1">Callbacks · {user?.name}</h1>
          <p className="page-subtitle">
            {callbackLeads.length === 0
              ? 'No pending callbacks'
              : `${callbackLeads.length} lead${callbackLeads.length !== 1 ? 's' : ''} to follow up`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLeads}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div className="kpi-strip">
        <div className="kpi gold">
          <div className="kpi-label">Callbacks</div>
          <div className="kpi-num">{callbackLeads.filter(l => l.status === 'Callback').length}</div>
          <div className="kpi-delta flat">pending</div>
        </div>
        <div className="kpi green">
          <div className="kpi-label">Interested</div>
          <div className="kpi-num">{callbackLeads.filter(l => l.status === 'Interested').length}</div>
          <div className="kpi-delta flat">warm leads</div>
        </div>
        <div className="kpi blue">
          <div className="kpi-label">Total</div>
          <div className="kpi-num">{callbackLeads.length}</div>
          <div className="kpi-delta flat">to follow up</div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* ── Callbacks table ── */}
      {callbackLeads.length === 0 ? (
        <div className="placeholder-wrap" style={{ marginTop: 8 }}>
          <CheckCheck size={32} color="var(--text3)" />
          <div className="placeholder-title">All clear</div>
          <p className="placeholder-sub">No pending callbacks or interested leads right now.</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-head" style={{ padding: '14px 18px 0' }}>
            <div className="panel-title">Pending Follow-ups</div>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
              sorted by priority
            </span>
          </div>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0, background: 'transparent' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Google</th>
                  <th>Status</th>
                  <th>Next Action</th>
                  <th>Last Note</th>
                  <th>Scheduled</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {callbackLeads.map(lead => (
                  <tr
                    key={lead.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="td-name">{lead.name}</td>
                    <td className="td-phone">{lead.phone || '—'}</td>
                    <td>{lead.city || '—'}</td>
                    <td style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatGoogleScore(lead.googleScore) || <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
                    </td>
                    <td><StatusBadge status={lead.status} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <NextActionBadge lead={lead} onClick={handleNextAction} />
                    </td>
                    <td style={{ maxWidth: 220, color: 'var(--text2)' }}>
                      {getCallbackNote(lead.id)}
                    </td>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} />
                        <span style={{ fontStyle: 'italic' }}>Not set</span>
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}
                          onClick={() => handleStartCall(lead)}
                          disabled={!lead.phone}
                        >
                          <Phone size={11} /> Call Now
                        </button>
                        {!(lead.tags || []).includes('welcome-email-sent') ? (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '4px 8px', gap: 4 }}
                            title="Send welcome email"
                            onClick={() => setWelcomeLead(lead)}
                          >
                            <Mail size={11} />
                          </button>
                        ) : (
                          <span className="email-sent-badge">✓</span>
                        )}
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 8px', gap: 4 }}
                          title="Send follow-up email"
                          onClick={() => setFollowUpLead(lead)}
                        >
                          <Send size={11} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}
                          onClick={() => setSelectedLead(lead)}
                          title="Open notes panel to reschedule"
                        >
                          <Calendar size={11} /> Reschedule
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px', gap: 4, color: 'var(--text3)' }}
                          onClick={() => handleMarkDone(lead)}
                          title="Mark as Called — removes from callbacks"
                        >
                          <CheckCheck size={11} /> Done
                        </button>
                      </div>
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
