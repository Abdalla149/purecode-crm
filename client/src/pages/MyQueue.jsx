import { useState, useEffect, useMemo, useRef } from 'react';
import { Phone, SkipForward, RefreshCw, Mail, Send, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDialer } from '../context/DialerContext';
import api from '../utils/api';
import CallWorkspace from '../components/CallWorkspace';
import LeadPanel from '../components/LeadPanel';
import WelcomeEmailPanel from '../components/WelcomeEmailPanel';
import FollowUpEmailPanel from '../components/FollowUpEmailPanel';
import NextActionBadge from '../components/NextActionBadge';
import { parseGoogleScore, formatGoogleScore, generateHook } from '../utils/leads';

// ── Constants ────────────────────────────────────────────────
const CALL_LIMIT = 30;

const STATUS_PRIORITY = {
  'New': 0, 'Callback': 1, 'Called': 2,
  'No Answer': 3, 'Voicemail': 4,
  'Interested': 5, 'Demo Booked': 6,
  'Closed': 7, 'Not Qualified': 8,
};

const STATUS_DONE = new Set(['Closed', 'Not Qualified']);

// ── Helpers ──────────────────────────────────────────────────
function sortLeads(leads) {
  return [...leads].sort((a, b) => {
    const sd = (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9);
    if (sd !== 0) return sd;
    return (Number(a.tier) || 2) - (Number(b.tier) || 2);
  });
}

// Pacific calendar day + 12-hour shift key (AM = 00:00–12:00, PM = 12:00–24:00).
function ptKeys() {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  const day = `${p.year}-${p.month}-${p.day}`;
  return { day, shift: `${day}-${(+p.hour % 24) < 12 ? 'AM' : 'PM'}` };
}

function loadCallCounts() {
  const { day, shift } = ptKeys();
  try {
    const raw = JSON.parse(localStorage.getItem('purecode_call_counts') || 'null');
    if (raw) {
      return {
        day,
        shift,
        // Calls Today resets every 12h shift; per-number counts persist for the day
        callsToday: raw.shift === shift ? (raw.callsToday || 0) : 0,
        counts:     raw.day === day     ? (raw.counts || {})   : {},
      };
    }
  } catch {}
  return { day, shift, counts: {}, callsToday: 0 };
}

function saveCallCounts(data) {
  localStorage.setItem('purecode_call_counts', JSON.stringify(data));
}

function getActiveNumber(phoneNumbers, callCounts) {
  for (const num of phoneNumbers) {
    if ((callCounts.counts?.[num.id] || 0) < CALL_LIMIT) return num;
  }
  return phoneNumbers[0];
}

// ── Small UI components ──────────────────────────────────────
function TierBadge({ tier }) {
  const t = Number(tier);
  const style = t === 1
    ? { color: 'var(--primary)', background: 'rgba(0,229,160,0.12)', border: '1px solid rgba(0,229,160,0.3)' }
    : t === 2
    ? { color: 'var(--gold)',    background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.3)' }
    : { color: 'var(--text3)',   background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', borderRadius: 4, padding: '2px 7px', fontFamily: "'DM Mono', monospace", ...style }}>
      TIER {tier || '—'}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    'New':          'badge-new',
    'Called':       'badge-called',
    'No Answer':    'badge-noanswer',
    'Voicemail':    'badge-noanswer',
    'Interested':   'badge-interested',
    'Demo Booked':  'badge-demo',
    'Closed':       'badge-interested',
    'Not Qualified':'badge-nq',
    'Callback':     'badge-called',
  };
  return <span className={`badge-status ${map[status] || 'badge-new'}`}>{status || 'New'}</span>;
}

// ── Main Component ───────────────────────────────────────────
export default function MyQueue() {
  const { user } = useAuth();
  const dialer   = useDialer();

  const [leads, setLeads]             = useState([]);
  const [dialWarning, setDialWarning] = useState(null);
  const warnTimer = useRef(null);

  function showDialWarning(msg) {
    setDialWarning(msg);
    clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setDialWarning(null), 4000);
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [stats, setStats]             = useState(null);
  const [queueIndex, setQueueIndex]   = useState(0);
  const [activeCall, setActiveCall]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [callCounts, setCallCounts]   = useState(loadCallCounts);
  const [selectedLead, setSelectedLead] = useState(null);
  const [agentKpi, setAgentKpi]       = useState(null);
  const [toast, setToast]             = useState(null);
  const [welcomeLead,  setWelcomeLead]  = useState(null);
  const [followUpLead, setFollowUpLead] = useState(null);
  const [kebabLeadId,  setKebabLeadId]  = useState(null);
  const [showCalled,   setShowCalled]   = useState(false);
  const [resumeLead,   setResumeLead]   = useState(null); // business name string
  const toastTimer = useRef(null);

  const phoneNumbers = user?.phoneNumbers || [];

  // ── Data fetching ──────────────────────────────────────────
  async function fetchLeads() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/leads');
      const loaded = data.leads || [];
      setLeads(loaded);
      checkResumePosition(loaded);
    } catch (err) {
      setError('Could not load your queue — try refreshing');
    } finally {
      setLoading(false);
    }
  }

  async function checkResumePosition(loadedLeads) {
    try {
      const { data } = await api.get('/agent/session/position');
      if (!data.lastLeadId) return;
      const sorted = sortLeads(loadedLeads).filter(l => !STATUS_DONE.has(l.status));
      const idx = sorted.findIndex(l => l.id === data.lastLeadId);
      if (idx > 0) {
        setQueueIndex(idx);
        setResumeLead(sorted[idx].name);
      }
    } catch {} // non-critical
  }

  async function fetchStats() {
    try {
      const [meRes, kpiRes] = await Promise.allSettled([
        api.get('/stats/me'),
        api.get('/stats/agent/me'),
      ]);
      if (meRes.status === 'fulfilled')  setStats(meRes.value.data.stats);
      if (kpiRes.status === 'fulfilled') setAgentKpi(kpiRes.value.data.stats);
    } catch {
      // Non-critical — stats panels just stay empty
    }
  }

  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, []);

  // ── Computed queue ─────────────────────────────────────────
  const sortedLeads = useMemo(() => sortLeads(leads), [leads]);
  const activeQueue = useMemo(
    () => sortedLeads.filter(l => !STATUS_DONE.has(l.status)),
    [sortedLeads]
  );
  const currentLead = activeQueue[queueIndex] || null;
  const queueDone   = leads.length > 0 && queueIndex >= activeQueue.length;
  const remaining   = Math.max(0, activeQueue.length - queueIndex);

  // Leads unworked (New or Callback) — drives the "Remaining" counter
  const uncalledCount = useMemo(
    () => sortedLeads.filter(l => l.status === 'New' || l.status === 'Callback').length,
    [sortedLeads]
  );

  // Table rows: hide already-called leads unless toggle is on
  const tableLeads = useMemo(
    () => showCalled
      ? sortedLeads
      : sortedLeads.filter(l => l.status === 'New' || l.status === 'Callback'),
    [sortedLeads, showCalled]
  );

  // ── Phone rotation ─────────────────────────────────────────
  const activeNumber = phoneNumbers.length > 0
    ? getActiveNumber(phoneNumbers, callCounts)
    : null;

  // ── Call handlers ──────────────────────────────────────────
  async function handleStartCall(lead) {
    if (!lead?.phone) {
      showDialWarning('This lead has no phone number');
      return;
    }

    const status = await dialer?.dialNumber(lead.phone);

    if (status === 'not-ready') {
      showDialWarning('Dialer is loading — try again in a moment');
      return;
    }
    if (status === 'error') {
      showDialWarning('Could not place call — try again');
      return;
    }

    setDialWarning(null);

    if (activeNumber) {
      const newCounts = {
        ...callCounts,
        counts: {
          ...callCounts.counts,
          [activeNumber.id]: (callCounts.counts?.[activeNumber.id] || 0) + 1,
        },
        callsToday: (callCounts.callsToday || 0) + 1,
      };
      setCallCounts(newCounts);
      saveCallCounts(newCounts);
    }

    // Persist position server-side for cross-device resume
    api.post('/agent/session/position', { leadId: lead.id }).catch(() => {});

    setActiveCall({ lead });
  }

  async function handleOutcome(outcome, noteText) {
    if (!activeCall || saving) return;
    setSaving(true);

    try {
      await api.post(`/leads/${activeCall.lead.id}/note`, {
        text: noteText || '',
        outcome,
      });

      // Update lead status locally
      setLeads(prev => prev.map(l =>
        l.id === activeCall.lead.id ? { ...l, status: outcome, lastOutcome: outcome } : l
      ));

      // Update local stats counters
      setStats(prev => prev ? {
        ...prev,
        interested:  outcome === 'Interested'  ? (prev.interested  || 0) + 1 : (prev.interested  || 0),
        demosBooked: outcome === 'Demo Booked' ? (prev.demosBooked || 0) + 1 : (prev.demosBooked || 0),
      } : prev);
    } catch {
      // Advance even if note fails — don't block the agent
    } finally {
      setSaving(false);
      setActiveCall(null);
      setQueueIndex(i => i + 1);
      const nextLead = activeQueue[queueIndex + 1];
      if (nextLead) api.post('/agent/session/position', { leadId: nextLead.id }).catch(() => {});
      showToast('Outcome saved — next lead loaded');
    }
  }

  function handleSkip(lead) {
    const nextIdx = queueIndex + 1;
    setQueueIndex(nextIdx);
    const nextLead = activeQueue[nextIdx];
    if (nextLead) api.post('/agent/session/position', { leadId: nextLead.id }).catch(() => {});
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

  async function handleUnassign(lead) {
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, assignedAgent: '' } : l));
    showToast('Lead unassigned');
    try {
      await api.put(`/leads/${lead.id}/assign`, { agentId: '' });
    } catch {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, assignedAgent: lead.assignedAgent } : l));
      showToast('Could not unassign — try again');
    }
  }

  function handleNextAction(action, lead) {
    if (action === 'welcome')   { setWelcomeLead(lead);  return; }
    if (action === 'followup')  { setFollowUpLead(lead); return; }
    if (action === 'call')      { handleStartCall(lead); return; }
    if (action === 'demo-prep') { showToast('Demo prep checklist coming soon'); return; }
    if (action === 'notify')    { showToast('David has been notified'); return; }
  }

  // ── Render helpers ─────────────────────────────────────────
  const totalCalls = callCounts.callsToday || 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--text3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading your queue…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '14px 18px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 12 }}>
          {error}
          <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={fetchLeads}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Call workspace replaces page content while a call is active ──────────
  if (activeCall) {
    return (
      <>
        {toast && <div className="toast-notification">{toast}</div>}
        <CallWorkspace
          lead={activeCall.lead}
          agentName={user?.name || 'Agent'}
          onOutcome={handleOutcome}
          onExit={() => setActiveCall(null)}
          saving={saving}
          queueStats={{
            totalCalls: totalCalls,
            interested: stats?.interested ?? 0,
            demos:      stats?.demosBooked ?? 0,
          }}
          nextLeads={activeQueue.slice(queueIndex + 1, queueIndex + 4)}
        />
      </>
    );
  }

  return (
    <>
      {/* ── Toast notification ── */}
      {toast && <div className="toast-notification">{toast}</div>}

      {/* ── Lead CRM panel ── */}
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

      {/* ── Resume banner ── */}
      {resumeLead && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.25)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 14, fontSize: 13,
        }}>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
            ↩ Resumed from your last session — {resumeLead}
          </span>
          <button
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}
            onClick={() => { setResumeLead(null); setQueueIndex(0); }}
          >
            Start from top
          </button>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="page-head">
        <div>
          <h1 className="page-h1">My Queue · {user?.name}</h1>
          <p className="page-subtitle">
            {leads.length === 0
              ? 'No leads assigned yet'
              : `Called today: ${totalCalls} · Remaining: ${uncalledCount}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showCalled}
              onChange={e => setShowCalled(e.target.checked)}
              style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            Show already-called leads
          </label>
          <button className="btn btn-secondary" onClick={() => { fetchLeads(); fetchStats(); }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="kpi-strip">
        <div className="kpi green">
          <div className="kpi-label">Calls Today</div>
          <div className="kpi-num">{totalCalls}</div>
          <div className="kpi-delta flat">this session</div>
        </div>
        <div className="kpi orange">
          <div className="kpi-label">Interested</div>
          <div className="kpi-num">{stats?.interested ?? '—'}</div>
          <div className="kpi-delta flat">total</div>
        </div>
        <div className="kpi purple">
          <div className="kpi-label">Demos Booked</div>
          <div className="kpi-num">{stats?.demosBooked ?? '—'}</div>
          <div className="kpi-delta flat">total</div>
        </div>
        <div className="kpi blue">
          <div className="kpi-label">In Queue</div>
          <div className="kpi-num">{remaining}</div>
          <div className="kpi-delta flat">leads left</div>
        </div>
      </div>

      {/* ── Phone rotation bar ── */}
      {phoneNumbers.length > 0 && (
        <div className="phone-rot">
          <div className="pr-label">Your Numbers</div>
          <div className="pr-nums">
            {phoneNumbers.map(num => {
              const count = callCounts.counts?.[num.id] || 0;
              const isActive = activeNumber?.id === num.id;
              const isFull   = count >= CALL_LIMIT;
              return (
                <div key={num.id} className={`pr-num${isActive ? ' active' : ''}`}>
                  {num.number}
                  <span className="pr-counter" style={isFull ? { color: 'var(--orange)' } : {}}>
                    {isFull ? '⚠ full' : `${count}/${CALL_LIMIT}`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="pr-tip">
            {activeNumber
              ? `#${phoneNumbers.findIndex(n => n.id === activeNumber.id) + 1} active · rotates at ${CALL_LIMIT} calls`
              : 'All numbers at limit'}
          </div>
        </div>
      )}

      {/* ── Agent KPI strip (GHL-sourced) ── */}
      <div className="kpi-strip" style={{ marginTop: 12 }}>
        <div className="kpi green">
          <div className="kpi-label">📞 Calls Today</div>
          <div className="kpi-num">{agentKpi?.callsToday ?? '—'}</div>
          <div className="kpi-delta flat">total contacted</div>
        </div>
        <div className="kpi orange">
          <div className="kpi-label">🔥 Interested</div>
          <div className="kpi-num">{agentKpi?.interested ?? '—'}</div>
          <div className="kpi-delta flat">warm leads</div>
        </div>
        <div className="kpi purple">
          <div className="kpi-label">⭐ Demos Booked</div>
          <div className="kpi-num">{agentKpi?.demosBooked ?? '—'}</div>
          <div className="kpi-delta flat">scheduled</div>
        </div>
        <div className="kpi blue">
          <div className="kpi-label">⏱ Talk Time</div>
          <div className="kpi-num">{agentKpi?.talkTime ?? 0}</div>
          <div className="kpi-delta flat">minutes</div>
        </div>
      </div>

      {/* ── Dialer warning banner ── */}
      {dialWarning && (
        <div style={{
          background:  'rgba(245,158,11,0.12)',
          border:      '1px solid rgba(245,158,11,0.35)',
          borderRadius: 8,
          padding:     '10px 16px',
          color:       'var(--gold)',
          fontSize:    13,
          fontWeight:  600,
          marginBottom: 12,
          display:     'flex',
          alignItems:  'center',
          gap:         8,
        }}>
          <Phone size={14} />
          {dialWarning}
        </div>
      )}

      {/* ── Next Call hero card ── */}
      {queueDone ? (
        <div className="queue-done">
          <div style={{ fontSize: 32 }}>✓</div>
          <div className="queue-done-title">Queue Complete!</div>
          <p className="queue-done-sub">
            You've worked through all {activeQueue.length} leads. Great work today.
          </p>
          <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setQueueIndex(0)}>
            Start Over
          </button>
        </div>
      ) : currentLead ? (
        <div className="next-call">
          <div className="nc-grid">
            <div>
              {/* ── Label row with tier badge ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div className="nc-up-label" style={{ margin: 0 }}>▸ NEXT IN QUEUE</div>
                {currentLead.businessType && (
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
                    {currentLead.businessType.toUpperCase()}
                  </span>
                )}
              </div>

              {/* ── Business name ── */}
              <div className="nc-biz">{currentLead.name}</div>

              {/* ── Meta row ── */}
              <div className="nc-meta">
                <div className="nc-meta-item">
                  <Phone size={11} />
                  <strong>{currentLead.phone || 'No phone'}</strong>
                </div>
                {(currentLead.city || currentLead.state) && (
                  <div className="nc-meta-item">
                    📍 {[currentLead.city, currentLead.state].filter(Boolean).join(', ')}
                  </div>
                )}
                <div className="nc-meta-item">
                  {currentLead.ownerName
                    ? <>Owner: <strong>{currentLead.ownerName}</strong></>
                    : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Owner unknown — ask for the owner</span>
                  }
                </div>
                {formatGoogleScore(currentLead.googleScore) && (
                  <div className="nc-meta-item" style={{ color: 'var(--gold)', fontWeight: 600 }}>
                    {formatGoogleScore(currentLead.googleScore)}
                  </div>
                )}
              </div>

              {/* ── Warning ── */}
              {currentLead.warning && (
                <div className="nc-warning">⚠ {currentLead.warning}</div>
              )}

              {/* ── Hook — real or auto-generated ── */}
              {generateHook(currentLead) && (
                <div className="nc-hook">
                  <span className="lbl">{currentLead.hookNote ? '★ Hook ★' : '★ Auto Hook ★'}</span>
                  {generateHook(currentLead)}
                </div>
              )}
            </div>

            <div className="nc-actions">
              <button
                className="nc-call-btn"
                onClick={() => handleStartCall(currentLead)}
                disabled={!currentLead.phone}
                title={currentLead.phone ? 'Call now' : 'No phone number'}
              >
                <div className="nc-icon"><Phone size={26} strokeWidth={2.5} /></div>
                <div className="nc-label">CALL NOW</div>
              </button>
              <div className="nc-skip" onClick={() => handleSkip(currentLead)}>
                <SkipForward size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Skip lead
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Queue table ── */}
      {sortedLeads.length > 0 && (
        <div className="panel" style={{ padding: 0, marginTop: 4 }}>
          <div className="panel-head" style={{ padding: '16px 18px 0' }}>
            <div className="panel-title">Lead Queue · Up Next</div>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
              {tableLeads.length} shown{!showCalled && sortedLeads.length > tableLeads.length ? ` · ${sortedLeads.length - tableLeads.length} hidden (called)` : ''}
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
                  <th>Next Action</th>
                  <th>Hook</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tableLeads.map((lead, idx) => {
                  const isNext  = lead.id === currentLead?.id;
                  const isDone  = STATUS_DONE.has(lead.status);
                  const gScore  = formatGoogleScore(lead.googleScore);
                  const hook    = generateHook(lead);
                  return (
                    <tr
                      key={lead.id}
                      className={isNext ? 'tbl-row-active' : ''}
                      style={{ ...(isDone ? { opacity: 0.45 } : {}), cursor: 'pointer' }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="td-mono" style={{ color: isNext ? 'var(--primary)' : 'var(--text3)', fontWeight: isNext ? 700 : 400 }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="td-name">{lead.name}</td>
                      <td className="td-phone">{lead.phone || '—'}</td>
                      <td>{lead.city || '—'}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                        {gScore || <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
                      </td>
                      <td><StatusBadge status={lead.status} /></td>
                      <td onClick={e => e.stopPropagation()}>
                        <NextActionBadge lead={lead} onClick={handleNextAction} />
                      </td>
                      <td style={{ fontStyle: 'italic', color: 'var(--text3)', fontSize: 12, maxWidth: 180 }}>
                        {hook
                          ? <span title={hook} style={!lead.hookNote ? { opacity: 0.6 } : {}}>
                              {hook.length > 45 ? hook.slice(0, 45) + '…' : hook}
                            </span>
                          : '—'
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                          {!isDone && (
                            <button
                              className={isNext ? 'btn btn-primary' : 'btn btn-secondary'}
                              style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}
                              onClick={() => handleStartCall(lead)}
                              disabled={!lead.phone}
                            >
                              <Phone size={11} /> Call
                            </button>
                          )}
                          {!(lead.tags || []).includes('welcome-email-sent') ? (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '4px 8px' }}
                              title="Send welcome email"
                              onClick={() => setWelcomeLead(lead)}
                            >
                              <Mail size={10} />
                            </button>
                          ) : (
                            <span className="email-sent-badge">✓</span>
                          )}
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            title="Send follow-up"
                            onClick={() => setFollowUpLead(lead)}
                          >
                            <Send size={10} />
                          </button>
                          {user?.role === 'admin' && lead.assignedAgent && (
                            <div style={{ position: 'relative' }}>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                title="More options"
                                onClick={() => setKebabLeadId(prev => prev === lead.id ? null : lead.id)}
                              >
                                <MoreHorizontal size={10} />
                              </button>
                              {kebabLeadId === lead.id && (
                                <div style={{
                                  position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
                                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                                  borderRadius: 6, overflow: 'hidden',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
                                }}>
                                  <div
                                    style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--red)' }}
                                    onClick={() => { setKebabLeadId(null); handleUnassign(lead); }}
                                  >
                                    Unassign from agent
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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

      {/* ── Empty state ── */}
      {leads.length === 0 && !loading && (
        <div className="placeholder-wrap" style={{ marginTop: 24 }}>
          <Phone size={32} color="var(--text3)" />
          <div className="placeholder-title">No leads assigned yet</div>
          <p className="placeholder-sub">
            Ask David to assign leads to your account, then refresh this page.
          </p>
        </div>
      )}
    </>
  );
}
