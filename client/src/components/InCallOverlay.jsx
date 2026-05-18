import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';

const TABS = ['OPENER', 'PITCH', 'OBJECTIONS', 'CLOSE'];

function buildScripts(lead, agentName) {
  const biz     = lead?.name        || 'the business';
  const owner   = lead?.ownerName   || 'there';
  const city    = lead?.city        || 'your area';
  const type    = lead?.businessType || 'service';
  const score   = lead?.googleScore;
  const hook    = lead?.hookNote;

  return {
    OPENER: hook
      ? `"Hey ${owner} — this is ${agentName} with PureCode Agency. Super quick. ${hook}\n\nIs that something you're still dealing with? … Got 90 seconds?"`
      : `"Hey ${owner} — this is ${agentName} with PureCode Agency. I was looking at ${biz}'s Google profile and had a quick question about your lead follow-up process.\n\nAre missed calls or slow follow-ups costing you jobs? … [pause] … That's exactly why I'm calling. Got 90 seconds?"`,

    PITCH: `"We build an AI receptionist specifically for ${type} companies in ${city}.\n\nIt answers every call 24/7 — when you're on a job, after hours, weekends. Books straight to your calendar, handles FAQs, routes urgent jobs directly to you.\n\nMost ${type} businesses we work with start booking 20–30% more jobs within the first month, just from calls they were already getting but missing.\n\nWe set it up in about a week, completely done-for-you."`,

    OBJECTIONS: `"I'm too busy right now."
→ "That's the point — it runs itself. Takes me 2 minutes to explain."

"I already have someone answering calls."
→ "Does she answer at 9pm when a homeowner has an emergency? Ours does."

"How much is it?"
→ "Before I give you a number, quick question: how many calls do you get per day roughly?"

"Not interested."
→ "Fair. Is that a timing thing, or are you genuinely happy with how many jobs you're closing right now?"

"We tried something like this."
→ "What happened? … [Listen] … That's not us. We focus only on ${type} companies — it's built different."`,

    CLOSE: `"Based on what you told me — ${type} business in ${city}, looking to book more jobs — this is exactly what we built this for.\n\nI'd love to do a quick 20-minute screen share where I show you how it works for ${biz} specifically.\n\nI have Thursday morning and Friday afternoon this week — which is easier for you?"`,
  };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const OUTCOMES = [
  { key: 'No Answer',     label: 'No Answer',    cls: '' },
  { key: 'Voicemail',     label: 'Voicemail',    cls: '' },
  { key: 'Interested',    label: 'Interested',   cls: 'interested' },
  { key: 'Demo Booked',   label: 'Demo Booked',  cls: 'demo' },
  { key: 'Not Qualified', label: 'Not Qualified',cls: '' },
  { key: 'Callback',      label: 'Callback',     cls: '' },
];

export default function InCallOverlay({ lead, agentName, onOutcome, saving }) {
  const [seconds, setSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState('OPENER');
  const [note, setNote] = useState('');
  const [muted, setMuted] = useState(false);
  const noteRef = useRef(null);

  const scripts = buildScripts(lead, agentName);

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function handleOutcome(outcomeKey) {
    if (saving) return;
    onOutcome(outcomeKey, note);
  }

  // Trap focus inside overlay
  useEffect(() => {
    const el = document.querySelector('.call-interface');
    if (el) el.focus?.();
  }, []);

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true">
      <div className="call-interface">

        {/* ── Left — timer, script ── */}
        <div className="ci-left">
          <div className="ci-status">ON CALL · LIVE</div>
          <div className="ci-biz">{lead.name}</div>
          <div className="ci-num">
            {lead.phone}
            {lead.city ? ` · ${lead.city}${lead.state ? ', ' + lead.state : ''}` : ''}
          </div>
          <div className="ci-timer">{formatTime(seconds)}</div>

          <div className="ci-controls">
            <button
              className={`ci-ctrl${muted ? ' active' : ''}`}
              style={muted ? { color: 'var(--orange)', borderColor: 'rgba(255,107,53,0.4)' } : {}}
              onClick={() => setMuted(m => !m)}
            >
              {muted ? <MicOff size={12} /> : <Mic size={12} />}
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button className="ci-ctrl" onClick={() => noteRef.current?.focus()}>
              <Phone size={12} /> Note
            </button>
            <button
              className="ci-ctrl danger"
              onClick={() => handleOutcome('Called')}
              disabled={saving}
            >
              <PhoneOff size={12} /> End Call
            </button>
          </div>

          {/* Script tabs */}
          <div className="ci-script-wrap">
            <div className="ci-script-tabs">
              {TABS.map(tab => (
                <button
                  key={tab}
                  className={`ci-script-tab${activeTab === tab ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="ci-script">{scripts[activeTab]}</div>
          </div>
        </div>

        {/* ── Right — lead info + outcomes ── */}
        <div className="ci-right">
          <div className="ci-side-label">Lead Info</div>
          <div className="ci-side-info">
            {lead.ownerName && (
              <div className="ci-side-info-row">
                <span>Owner</span><strong>{lead.ownerName}</strong>
              </div>
            )}
            {lead.businessType && (
              <div className="ci-side-info-row">
                <span>Type</span><strong>{lead.businessType}</strong>
              </div>
            )}
            <div className="ci-side-info-row">
              <span>Tier</span>
              <strong style={{ color: lead.tier === 1 || lead.tier === '1' ? 'var(--primary)' : 'inherit' }}>
                T{lead.tier || '—'}{lead.tier === 1 || lead.tier === '1' ? ' · Hot' : ''}
              </strong>
            </div>
            {lead.googleScore && (
              <div className="ci-side-info-row">
                <span>Google</span><strong>{lead.googleScore} ★</strong>
              </div>
            )}
            <div className="ci-side-info-row">
              <span>Last</span><strong>{lead.lastOutcome || lead.status || '—'}</strong>
            </div>
          </div>

          {lead.warning && (
            <>
              <div className="ci-side-label">Warning</div>
              <div style={{
                background: 'rgba(255,107,53,0.1)',
                border: '1px solid rgba(255,107,53,0.3)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                color: 'var(--orange)',
                lineHeight: 1.5,
              }}>
                {lead.warning}
              </div>
            </>
          )}

          <div className="ci-side-label">Quick Note</div>
          <textarea
            ref={noteRef}
            className="ci-note-area"
            placeholder="Type while you talk..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />

          <div className="ci-side-label">Log Outcome</div>
          <div className="ci-outcomes-grid">
            {OUTCOMES.map(({ key, label, cls }) => (
              <button
                key={key}
                className={`ci-out-btn${cls ? ' ' + cls : ''}${saving ? ' disabled' : ''}`}
                onClick={() => handleOutcome(key)}
                disabled={saving}
              >
                {saving ? '…' : label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
