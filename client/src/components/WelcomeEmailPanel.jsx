import { useState, useEffect, useRef } from 'react';
import { X, Mail, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

// Each agent's unique intake form URL
const FORM_URLS = {
  lucas: 'https://api.leadconnectorhq.com/widget/form/miAbvJbWMezgkU58uaVu',
  harry: 'https://api.leadconnectorhq.com/widget/form/wh88riZOD2xmwNJqIdC5',
  jim:   'https://api.leadconnectorhq.com/widget/form/ekPXy2V8zXTf20CWMIol',
  bruce: 'https://api.leadconnectorhq.com/widget/form/RHMx5QauyWafoaAGNHXC',
};

export default function WelcomeEmailPanel({ lead, onClose, onSent }) {
  const { user } = useAuth();
  const [sent,    setSent]    = useState(false);
  const [saving,  setSaving]  = useState(false);
  const closeTimer = useRef(null);

  const formUrl = FORM_URLS[user?.name?.toLowerCase()];

  // Listen for the GHL form postMessage submit event
  useEffect(() => {
    function onMessage(e) {
      const d = e.data;
      if (!d) return;
      const isSubmit =
        d === 'form-submitted' ||
        (typeof d === 'object' && (
          d.type === 'form-submitted' ||
          d.type === 'LC_FORM_SUBMIT' ||
          d.type === 'leadSubmitted' ||
          d.event === 'form-submitted' ||
          (d.type === 'message' && d.message?.type === 'form:submit')
        ));
      if (isSubmit) handleFormSubmitted();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [lead.id]); // eslint-disable-line

  // ESC closes
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  async function handleFormSubmitted() {
    if (sent || saving) return;
    setSaving(true);
    try {
      await api.post(`/leads/${lead.id}/welcome-email`);
      setSent(true);
      if (onSent) onSent(lead.id);
      closeTimer.current = setTimeout(onClose, 2000);
    } catch {
      // Silent — agent can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="sp-backdrop" onClick={onClose} />
      <aside className="we-panel">
        {/* Header */}
        <div className="we-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="we-header-label">
              <Mail size={13} style={{ flexShrink: 0 }} />
              Send Welcome Email
            </div>
            <div className="we-header-biz">{lead.name}</div>
            <div className="we-header-sub">
              {[lead.phone, lead.city].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button className="sp-close" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Sent confirmation */}
        {sent ? (
          <div className="we-sent-state">
            <CheckCircle size={40} color="var(--primary)" />
            <div className="we-sent-title">Email sent!</div>
            <p className="we-sent-sub">Lead moved to Interested. Closing in a moment…</p>
          </div>
        ) : (
          <>
            {/* Instruction */}
            {!formUrl && (
              <div style={{ padding: '14px 18px', fontSize: 12, color: 'var(--orange)', background: 'rgba(255,107,53,0.08)', borderBottom: '1px solid var(--border)' }}>
                No form configured for this account. Contact David.
              </div>
            )}

            {/* Iframe */}
            {formUrl && (
              <div className="we-iframe-wrap">
                <iframe
                  src={formUrl}
                  title="Welcome Email Form"
                  className="we-iframe"
                  allow="*"
                  frameBorder="0"
                />
              </div>
            )}

            {/* Manual fallback */}
            <div className="we-footer">
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                Already submitted the form?
              </span>
              <button
                className="btn btn-primary"
                style={{ fontSize: 11, padding: '5px 14px' }}
                onClick={handleFormSubmitted}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Mark as Sent'}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
