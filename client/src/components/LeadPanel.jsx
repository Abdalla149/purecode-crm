import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatGoogleScore, fmtDate } from '../utils/leads';

const STATUS_BTNS = [
  { label: 'No Answer',     value: 'No Answer',     cls: '' },
  { label: 'Voicemail',     value: 'Voicemail',     cls: '' },
  { label: 'Called',        value: 'Called',        cls: '' },
  { label: 'Callback',      value: 'Callback',      cls: 'sp-btn-callback' },
  { label: 'Interested',    value: 'Interested',    cls: 'sp-btn-interested' },
  { label: 'Demo Booked',   value: 'Demo Booked',   cls: 'sp-btn-demo' },
  { label: 'Not Qualified', value: 'Not Qualified', cls: 'sp-btn-nq' },
];

export default function LeadPanel({ lead, onClose, onStatusUpdate }) {
  const { user } = useAuth();
  const [notes, setNotes]               = useState([]);
  const [noteText, setNoteText]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [currentStatus, setCurrentStatus] = useState(lead.status);
  const taRef = useRef(null);

  useEffect(() => {
    setCurrentStatus(lead.status);
    setNoteText('');
    setLoadingNotes(true);
    api.get(`/leads/${lead.id}`)
      .then(({ data }) => setNotes(data.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
    setTimeout(() => taRef.current?.focus(), 60);
  }, [lead.id]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSaveNote() {
    const text = noteText.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await api.post(`/leads/${lead.id}/note`, { text });
      setNotes(prev => [{
        id: Date.now(),
        text: `[Note] by ${user?.name}: ${text}`,
        createdAt: new Date().toISOString(),
      }, ...prev]);
      setNoteText('');
    } catch {}
    finally { setSaving(false); }
  }

  async function handleStatus(status) {
    if (saving) return;
    setSaving(true);
    try {
      const text = noteText.trim();
      await api.post(`/leads/${lead.id}/note`, { text, outcome: status });
      setCurrentStatus(status);
      onStatusUpdate(lead.id, status);
      if (text) {
        setNotes(prev => [{
          id: Date.now(),
          text: `[${status}] by ${user?.name}: ${text}`,
          createdAt: new Date().toISOString(),
        }, ...prev]);
        setNoteText('');
      }
    } catch {}
    finally { setSaving(false); }
  }

  const gScore = formatGoogleScore(lead.googleScore);

  return (
    <>
      <div className="sp-backdrop" onClick={onClose} />
      <aside className="side-panel">

        {/* ── Header ── */}
        <div className="sp-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sp-header-biz">{lead.name}</div>
            <div className="sp-header-sub">
              {[lead.city, lead.state].filter(Boolean).join(', ')}
              {lead.businessType ? ` · ${lead.businessType}` : ''}
            </div>
          </div>
          <button className="sp-close" onClick={onClose}><X size={15} /></button>
        </div>

        {/* ── Lead info ── */}
        <div className="sp-info-grid">
          {[
            ['Phone',   lead.phone         || '—'],
            ['Google',  gScore             || '—'],
            ['Owner',   lead.ownerName     || 'Unknown — ask'],
            ['Status',  currentStatus      || 'New'],
            ['Hook',    lead.hookNote      || '—'],
          ].map(([k, v]) => (
            <div className="sp-info-row" key={k}>
              <span className="sp-info-key">{k}</span>
              <span className="sp-info-val">{v}</span>
            </div>
          ))}
        </div>

        {/* ── Add note ── */}
        <div className="sp-section-label">Add Note</div>
        <textarea
          ref={taRef}
          className="sp-note-input"
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Type a note — optional. Click a status button below to save with outcome, or Save Note Only."
          rows={3}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSaveNote(); }}
        />
        <button
          className="btn btn-secondary sp-save-note"
          onClick={handleSaveNote}
          disabled={!noteText.trim() || saving}
        >
          {saving ? 'Saving…' : 'Save Note Only'}
        </button>

        {/* ── Status buttons ── */}
        <div className="sp-section-label">Update Status</div>
        <div className="sp-status-grid">
          {STATUS_BTNS.map(({ label, value, cls }) => (
            <button
              key={value}
              className={`sp-status-btn ${cls}${currentStatus === value ? ' active' : ''}`}
              onClick={() => handleStatus(value)}
              disabled={saving}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Call history ── */}
        <div className="sp-section-label" style={{ marginTop: 8 }}>
          Call History
          {notes.length > 0 && <span className="sp-count">{notes.length}</span>}
        </div>
        <div className="sp-notes-list">
          {loadingNotes
            ? <div className="sp-empty">Loading…</div>
            : notes.length === 0
            ? <div className="sp-empty">No notes yet — this is a fresh lead.</div>
            : notes.map((n, i) => (
              <div className="sp-note-item" key={n.id || i}>
                <div className="sp-note-text">{n.text}</div>
                <div className="sp-note-meta">{fmtDate(n.createdAt)}</div>
              </div>
            ))
          }
        </div>
      </aside>
    </>
  );
}
