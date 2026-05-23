import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const TEMPLATES = [
  {
    num: 1,
    label: '2-Day Check-In',
    subject: (lead) => `Quick follow up — ${lead.name}`,
    body: (lead, agentName) =>
`Hey ${lead.ownerName || 'there'},

Just wanted to check if you had a chance to look over what I sent. Our AI receptionist handles calls 24/7 so you never miss a customer.

Any questions — just reply here.

— ${agentName}
PureCode Agency`,
  },
  {
    num: 2,
    label: 'Value Reminder',
    subject: () => `Missing calls = missing money`,
    body: (lead, agentName) =>
`Hey ${lead.ownerName || 'there'},

Most ${lead.businessType || 'service'} businesses miss 30–40% of calls after hours. Our AI picks up every one and books the appointment automatically.

Growth tier is $497/month — no contracts, no long-term commitment.

Worth a 10-minute call?

— ${agentName}
PureCode Agency`,
  },
  {
    num: 3,
    label: 'Final Attempt',
    subject: (lead) => `Last one from me, ${lead.ownerName || 'there'}`,
    body: (lead, agentName) =>
`Hey ${lead.ownerName || 'there'},

I won't keep following up after this. If timing isn't right, totally understand.

But if you ever want to stop missing calls, I'm here.

— ${agentName}
PureCode Agency`,
  },
  {
    num: 4,
    label: 'Special Offer',
    subject: (lead) => `Special offer for ${lead.name}`,
    body: (lead, agentName) =>
`Hey ${lead.ownerName || 'there'},

We're running a special right now: first 30 days free, then $497/month on the Growth tier — no contracts.

Want me to get you set up?

— ${agentName}
PureCode Agency`,
  },
];

export default function FollowUpEmailPanel({ lead, onClose, onSent }) {
  const { user } = useAuth();
  const agentName = user?.name || 'Your Agent';

  const [active,  setActive]  = useState(0);
  const [subject, setSubject] = useState('');
  const [body,    setBody]    = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  // Populate template on switch
  useEffect(() => {
    const tpl = TEMPLATES[active];
    setSubject(tpl.subject(lead));
    setBody(tpl.body(lead, agentName));
  }, [active, lead.id]); // eslint-disable-line

  // ESC closes
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSend() {
    if (sending) return;
    setSending(true);
    try {
      await api.post('/emails/send-followup', {
        leadId:         lead.id,
        templateNumber: TEMPLATES[active].num,
        subject,
        body,
      });
      setSent(true);
      if (onSent) onSent(lead.id);
      setTimeout(onClose, 2000);
    } catch {
      // Silent — agent can retry
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="sp-backdrop" onClick={onClose} />
      <aside className="fu-panel">
        {/* Header */}
        <div className="we-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="we-header-label">
              <Send size={13} style={{ flexShrink: 0 }} />
              Send Follow-Up
            </div>
            <div className="we-header-biz">{lead.name}</div>
            <div className="we-header-sub">
              {[lead.phone, lead.city].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button className="sp-close" onClick={onClose}><X size={15} /></button>
        </div>

        {sent ? (
          <div className="we-sent-state">
            <Send size={36} color="var(--primary)" />
            <div className="we-sent-title">Follow-up logged!</div>
            <p className="we-sent-sub">Zoho send wiring coming in Phase 3. Closing…</p>
          </div>
        ) : (
          <div className="fu-body">
            {/* Template picker */}
            <div className="fu-templates">
              {TEMPLATES.map((t, i) => (
                <button
                  key={t.num}
                  className={`fu-tpl-btn${active === i ? ' active' : ''}`}
                  onClick={() => setActive(i)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Subject */}
            <label className="fu-label">Subject</label>
            <input
              className="fu-input"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />

            {/* Body */}
            <label className="fu-label">Body</label>
            <textarea
              className="fu-textarea"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
            />

            {/* Actions */}
            <div className="fu-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={sending || !body.trim()}
              >
                <Send size={12} />
                {sending ? 'Sending…' : 'Send Email'}
              </button>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 6 }}>
              Phase 1: logged as note. Real send wiring in Phase 3.
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
