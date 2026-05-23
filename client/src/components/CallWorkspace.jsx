import { useState, useEffect, useRef } from 'react';
import { parseGoogleScore, generateHook } from '../utils/leads';

const TABS = ['OPENER', 'PITCH', 'OBJECTIONS', 'CLOSE'];

const OUTCOMES = [
  { key: 'No Answer',     label: 'No Answer',     cls: '',           shortcut: '1' },
  { key: 'Voicemail',     label: 'Voicemail',     cls: '',           shortcut: '2' },
  { key: 'Interested',    label: 'Interested',    cls: 'interested', shortcut: '3' },
  { key: 'Demo Booked',   label: 'Demo Booked',   cls: 'demo',       shortcut: '4' },
  { key: 'Callback',      label: 'Callback',      cls: '',           shortcut: '5' },
  { key: 'Not Qualified', label: 'Not Qualified', cls: '',           shortcut: '6' },
];

const KEY_MAP = Object.fromEntries(OUTCOMES.map(o => [o.shortcut, o.key]));

function buildScripts(lead, agentName) {
  const biz   = lead?.name         || 'the business';
  const owner = lead?.ownerName    || 'there';
  const city  = lead?.city         || 'your area';
  const type  = lead?.businessType || 'service';
  const hook  = lead?.hookNote;

  return {
    OPENER: hook
      ? `"Hey ${owner} — this is ${agentName} with PureCode Agency. Super quick. ${hook}\n\nIs that something you're still dealing with? … Got 90 seconds?"`
      : `"Hey ${owner} — this is ${agentName} with PureCode Agency. I was looking at ${biz}'s Google profile and had a quick question about your lead follow-up process.\n\nAre missed calls or slow follow-ups costing you jobs? … [pause] … That's exactly why I'm calling. Got 90 seconds?"`,

    PITCH: `"We build an AI receptionist specifically for ${type} companies in ${city}.\n\nIt answers every call 24/7 — when you're on a job, after hours, weekends. Books straight to your calendar, handles FAQs, routes urgent jobs directly to you.\n\nMost ${type} businesses we work with start booking 20–30% more jobs within the first month.\n\nWe set it up in about a week, completely done-for-you."`,

    OBJECTIONS: `"I'm too busy right now."
→ "That's the point — it runs itself. Takes me 2 minutes to explain."

"I already have someone answering calls."
→ "Does she answer at 9pm when a homeowner has an emergency? Ours does."

"How much is it?"
→ "Before I give you a number — how many calls do you get per day roughly?"

"Not interested."
→ "Fair. Is that a timing thing, or are you genuinely happy with how many jobs you're closing right now?"

"We tried something like this."
→ "What happened? … [Listen] … That's not us. We focus only on ${type} companies — built different."`,

    CLOSE: `"Based on what you told me — ${type} business in ${city}, looking to book more jobs — this is exactly what we built this for.\n\nI'd love to do a quick 20-minute screen share where I show you how it works for ${biz} specifically.\n\nI have Thursday morning and Friday afternoon this week — which is easier for you?"`,
  };
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallWorkspace({ lead, agentName, onOutcome, onExit, saving, queueStats, nextLeads }) {
  const [seconds,      setSeconds]      = useState(0);
  const [activeTab,    setActiveTab]    = useState('OPENER');
  const [note,         setNote]         = useState('');
  const [draftSaved,   setDraftSaved]   = useState(false);
  const [objExpanded,  setObjExpanded]  = useState(false);
  const [starred,      setStarred]      = useState(false);
  const [exitConfirm,  setExitConfirm]  = useState(false);
  const noteRef       = useRef(null);
  const flashTimer    = useRef(null);
  const onOutcomeRef  = useRef(onOutcome);
  const onExitRef     = useRef(onExit);

  useEffect(() => { onOutcomeRef.current = onOutcome; }, [onOutcome]);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);

  const scripts = buildScripts(lead, agentName);
  const gscore  = parseGoogleScore(lead.googleScore);
  const hook    = generateHook(lead);

  // Live timer
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Restore draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`ws_draft_${lead.id}`);
    if (saved) setNote(saved);
  }, [lead.id]);

  // Autosave draft to localStorage every 3 s
  useEffect(() => {
    const id = setInterval(() => {
      localStorage.setItem(`ws_draft_${lead.id}`, note);
      setDraftSaved(true);
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setDraftSaved(false), 1400);
    }, 3000);
    return () => clearInterval(id);
  }, [note, lead.id]);

  // Keyboard shortcuts (disabled while note textarea focused)
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setExitConfirm(v => !v); // toggle: ESC again cancels the dialog
        return;
      }
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (saving) return;
      if (KEY_MAP[e.key]) {
        e.preventDefault();
        fire(KEY_MAP[e.key]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving]); // note is captured via onOutcomeRef

  function fire(outcomeKey) {
    if (saving) return;
    const fullNote = starred
      ? (note ? `${note}\n⭐ Marked for follow-up` : '⭐ Marked for follow-up')
      : note;
    localStorage.removeItem(`ws_draft_${lead.id}`);
    onOutcomeRef.current(outcomeKey, fullNote);
  }

  const convPct = queueStats?.totalCalls > 0
    ? Math.round(((queueStats.demos || 0) / queueStats.totalCalls) * 100)
    : null;

  return (
    <div className="workspace">

      {/* ── Exit confirmation dialog ── */}
      {exitConfirm && (
        <div className="ws-exit-overlay" onClick={() => setExitConfirm(false)}>
          <div className="ws-exit-dialog" onClick={e => e.stopPropagation()}>
            <div className="ws-exit-title">Exit without logging outcome?</div>
            <div className="ws-exit-body">
              The call timer will stop and no outcome will be saved. The lead stays at the top of your queue.
            </div>
            <div className="ws-exit-actions">
              <button className="btn btn-secondary" onClick={() => setExitConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn ws-exit-confirm-btn"
                onClick={() => { setExitConfirm(false); onExitRef.current?.(); }}
              >
                Exit anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lead info topbar ── */}
      <div className="ws-topbar">
        <div className="ws-lead-info">
          <div className="ws-lead-name">{lead.name}</div>
          <div className="ws-lead-meta">
            {lead.phone && <span className="ws-phone">{lead.phone}</span>}
            {(lead.city || lead.state) && (
              <span>📍 {[lead.city, lead.state].filter(Boolean).join(', ')}</span>
            )}
            {gscore && (
              <span className="ws-google">
                ⭐ {gscore.score}{gscore.reviews ? ` · ${gscore.reviews} reviews` : ''}
              </span>
            )}
            {lead.businessType && <span className="ws-biz-tag">{lead.businessType}</span>}
            {lead.tier && (
              <span className={`ws-tier-badge${lead.tier === '1' || lead.tier === 1 ? ' hot' : ''}`}>
                T{lead.tier}
              </span>
            )}
            {lead.ownerName && (
              <span style={{ color: 'var(--text3)', fontSize: 12 }}>Owner: <strong style={{ color: 'var(--text2)' }}>{lead.ownerName}</strong></span>
            )}
          </div>
          {lead.warning && <div className="ws-inline-warning">⚠ {lead.warning}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onExit && (
            <button
              className="ws-exit-btn"
              onClick={() => setExitConfirm(true)}
              title="Exit workspace without logging an outcome (ESC)"
            >
              ← Back to Queue
            </button>
          )}
          <div className="ws-timer-block">
            <div className="ws-timer">{formatTime(seconds)}</div>
            <div className="ws-timer-label">live</div>
          </div>
        </div>
      </div>

      {/* ── Smart hook ── */}
      {hook && (
        <div className="ws-hook">
          <span className="ws-hook-badge">HOOK</span>
          {hook}
        </div>
      )}

      {/* ── Main content grid ── */}
      <div className="ws-body">

        {/* Left: scripts + note + next leads */}
        <div className="ws-main">

          {/* Script tabs */}
          <div className="ws-tabs">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`ws-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="ws-script">{scripts[activeTab]}</div>

          {/* Note */}
          <div className="ws-note-wrap">
            <div className="ws-note-hdr">
              <span className="ws-section-label">Notes</span>
              {draftSaved && <span className="ws-draft-tag">Draft saved ✓</span>}
            </div>
            <textarea
              ref={noteRef}
              className="ws-note-area"
              placeholder="Type while you talk…"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={5}
            />
          </div>

          {/* Next leads preview */}
          {nextLeads && nextLeads.length > 0 && (
            <div className="ws-next-panel">
              <div className="ws-section-label" style={{ marginBottom: 8 }}>Up Next</div>
              {nextLeads.slice(0, 3).map((l, i) => (
                <div key={l.id} className="ws-next-row">
                  <span className="ws-next-idx">{i + 2}</span>
                  <span className="ws-next-name">{l.name}</span>
                  <span className="ws-next-sub">
                    {l.phone || 'No phone'}{l.city ? ` · ${l.city}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: stats + objections + lead card */}
        <div className="ws-aside">

          {/* Live session stats */}
          <div className="ws-panel">
            <div className="ws-section-label" style={{ marginBottom: 10 }}>Session Stats</div>
            <div className="ws-stat-row">
              <span>Calls today</span>
              <strong>{queueStats?.totalCalls ?? '—'}</strong>
            </div>
            <div className="ws-stat-row">
              <span>Interested</span>
              <strong style={{ color: 'var(--primary)' }}>{queueStats?.interested ?? '—'}</strong>
            </div>
            <div className="ws-stat-row">
              <span>Demos</span>
              <strong style={{ color: 'var(--purple)' }}>{queueStats?.demos ?? '—'}</strong>
            </div>
            {convPct !== null && (
              <div className="ws-stat-row">
                <span>Conversion</span>
                <strong style={{ color: 'var(--gold)' }}>{convPct}%</strong>
              </div>
            )}
          </div>

          {/* Quick objections cheatsheet */}
          <div className="ws-panel ws-obj-panel">
            <button className="ws-obj-toggle" onClick={() => setObjExpanded(e => !e)}>
              <span>Quick Objections</span>
              <span>{objExpanded ? '▲' : '▼'}</span>
            </button>
            {objExpanded && (
              <div className="ws-obj-list">
                <div className="ws-obj-row">
                  <strong>Too busy</strong>
                  <span>→ "That's why I called. Takes 2 minutes."</span>
                </div>
                <div className="ws-obj-row">
                  <strong>Not interested</strong>
                  <span>→ "Fair. Timing thing, or happy with your closing rate?"</span>
                </div>
                <div className="ws-obj-row">
                  <strong>Too expensive</strong>
                  <span>→ "Compared to losing one job a month?"</span>
                </div>
                <div className="ws-obj-row">
                  <strong>Have someone</strong>
                  <span>→ "Does she answer at 9pm? Ours does."</span>
                </div>
              </div>
            )}
          </div>

          {/* Lead extra info */}
          {(lead.lastOutcome || lead.status) && (
            <div className="ws-panel">
              <div className="ws-section-label" style={{ marginBottom: 8 }}>Lead History</div>
              <div className="ws-stat-row">
                <span>Last outcome</span>
                <strong>{lead.lastOutcome || lead.status}</strong>
              </div>
              {gscore?.reviews && (
                <div className="ws-stat-row">
                  <span>Reviews</span>
                  <strong style={{ color: 'var(--gold)' }}>{gscore.reviews}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Outcome bar — sticky bottom ── */}
      <div className="ws-outcome-bar">
        <div className="ws-outcome-row">
          {OUTCOMES.map(({ key, label, cls, shortcut }) => (
            <button
              key={key}
              className={`ws-out-btn${cls ? ' ' + cls : ''}${saving ? ' saving' : ''}`}
              onClick={() => fire(key)}
              disabled={saving}
            >
              <span className="ws-out-key">{shortcut}</span>
              <span>{saving ? '…' : label}</span>
            </button>
          ))}
          <button
            className={`ws-star-btn${starred ? ' on' : ''}`}
            onClick={() => setStarred(s => !s)}
            title={starred ? 'Follow-up flagged' : 'Mark for follow-up'}
          >
            {starred ? '★' : '☆'} Follow-up
          </button>
        </div>
        <div className="ws-shortcut-hint">
          Keys: 1 No Answer · 2 Voicemail · 3 Interested · 4 Demo Booked · 5 Callback · 6 Not Qualified
        </div>
      </div>

    </div>
  );
}
