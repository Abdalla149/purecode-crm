import { useState, useEffect } from 'react';
import { Mic, RefreshCw, PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react';
import api from '../utils/api';

// ── Helpers ────────────────────────────────────────────────

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const s = parseInt(seconds, 10);
  if (isNaN(s) || s < 0) return '—';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return '—';
    const day  = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${day} · ${time}`;
  } catch {
    return '—';
  }
}

// Strip email addresses and return just the first name
function cleanAgentName(name) {
  if (!name) return '—';
  const withoutEmail = name.replace(/\S*@\S+/g, '').replace(/[()[\]]/g, '').trim();
  const first = withoutEmail.split(/\s+/)[0];
  return first || name.split(/\s+/)[0] || name;
}

// ── Config ─────────────────────────────────────────────────

const AGENTS = ['Lucas', 'Harry', 'Jim', 'Bruce'];

const DATE_RANGES = [
  { value: 'last7',  label: 'Last 7 Days' },
  { value: 'today',  label: 'Today' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'all',    label: 'All Time' },
];

function getDateRange(range) {
  const today = new Date().toISOString().split('T')[0];
  if (range === 'today') return { from: today, to: today };
  if (range === 'last7') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  if (range === 'last30') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  return { from: '', to: '' };
}

const STATUS_CONFIG = {
  answered:   { label: 'Completed',  color: 'var(--primary)',  bg: 'rgba(0,229,160,0.12)' },
  completed:  { label: 'Completed',  color: 'var(--primary)',  bg: 'rgba(0,229,160,0.12)' },
  'no-answer':{ label: 'Missed',     color: 'var(--red)',      bg: 'var(--red-dim)' },
  missed:     { label: 'Missed',     color: 'var(--red)',      bg: 'var(--red-dim)' },
  voicemail:  { label: 'Voicemail',  color: 'var(--gold)',     bg: 'rgba(255,193,7,0.12)' },
  busy:       { label: 'Busy',       color: 'var(--gold)',     bg: 'rgba(255,193,7,0.12)' },
  failed:     { label: 'Failed',     color: 'var(--red)',      bg: 'var(--red-dim)' },
};

// ── Sub-components ─────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] || {
    label: status || '—',
    color: 'var(--text3)',
    bg: 'rgba(255,255,255,0.06)',
  };
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11, fontWeight: 700,
      padding: '3px 9px', borderRadius: 100,
      background: cfg.bg, color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function DirIcon({ direction }) {
  const dir = direction?.toLowerCase();
  if (dir === 'inbound')  return <PhoneIncoming  size={14} color="var(--primary)" title="Inbound" />;
  if (dir === 'outbound') return <PhoneOutgoing   size={14} color="var(--purple)"  title="Outbound" />;
  return <Phone size={14} color="var(--text3)" />;
}

// One audio player per row — only one open at a time (managed by parent)
function PlayCell({ url, isOpen, onOpen, onClose }) {
  if (!url) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>;
  if (isOpen) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <audio
          controls
          autoPlay
          src={url}
          style={{ height: 30, minWidth: 200, maxWidth: 240 }}
          onEnded={onClose}
        />
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 14, lineHeight: 1, padding: 2,
          }}
          title="Close player"
        >
          ✕
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 600, color: 'var(--primary)',
        background: 'var(--primary-dim)', padding: '4px 11px',
        borderRadius: 100, border: 'none', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      ▶ Play
    </button>
  );
}

function SkeletonRow() {
  const widths = ['100px', '55px', '20px', '48px', '72px', '145px', '64px'];
  return (
    <tr>
      {widths.map((w, i) => (
        <td key={i}>
          <div style={{
            height: 13, borderRadius: 4,
            background: 'rgba(255,255,255,0.07)',
            width: w,
          }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────

export default function Recordings() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [syncedAt, setSyncedAt]     = useState(null);
  const [openId, setOpenId]         = useState(null);   // which row has audio open

  // Filters
  const [agentFilter, setAgentFilter] = useState('');
  const [dateRange, setDateRange]     = useState('last7');

  async function fetchRecordings({ agent = agentFilter, range = dateRange, refresh = false } = {}) {
    setLoading(true);
    setError(null);
    setOpenId(null);
    try {
      const { from, to } = getDateRange(range);
      const params = new URLSearchParams();
      if (agent)   params.set('agent', agent);
      if (from)    params.set('from', from);
      if (to)      params.set('to', to);
      if (refresh) params.set('refresh', 'true');
      const qs = params.toString();
      const { data } = await api.get(`/recordings${qs ? `?${qs}` : ''}`);
      setRecordings(data.recordings || []);
      setSyncedAt(new Date());
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong — contact David';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecordings(); }, []);

  function handleAgentChange(e) {
    const val = e.target.value;
    setAgentFilter(val);
    fetchRecordings({ agent: val, range: dateRange });
  }

  function handleRangeChange(e) {
    const val = e.target.value;
    setDateRange(val);
    fetchRecordings({ agent: agentFilter, range: val });
  }

  const syncText = syncedAt ? 'Last synced just now' : '';
  const subtitle = loading
    ? 'Loading recordings…'
    : error
      ? 'Error loading recordings'
      : `${recordings.length} recording${recordings.length !== 1 ? 's' : ''} · ${syncText}`;

  const selectStyle = {
    padding: '6px 10px', minWidth: 140,
    background: 'var(--bg3)', color: 'var(--text)',
    border: '1px solid var(--border2)', borderRadius: 7,
    fontSize: 13, cursor: 'pointer',
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Recordings</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => fetchRecordings({ refresh: true })}
          disabled={loading}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={selectStyle} value={agentFilter} onChange={handleAgentChange}>
          <option value="">All Agents</option>
          {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={selectStyle} value={dateRange} onChange={handleRangeChange}>
          {DATE_RANGES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)',
          borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {/* Empty state — only when not loading and genuinely empty */}
      {!loading && !error && recordings.length === 0 ? (
        <div className="placeholder-wrap" style={{ marginTop: 8 }}>
          <Mic size={32} color="var(--text3)" />
          <div className="placeholder-title">No recordings yet</div>
          <p className="placeholder-sub">
            {agentFilter || dateRange !== 'all'
              ? 'Try "All Time" or a different agent filter.'
              : 'Calls with recordings will appear here once calls are made.'}
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-head" style={{ padding: '14px 18px 0' }}>
            <div className="panel-title">Call Recordings</div>
            {!loading && (
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                {recordings.length} total
              </span>
            )}
          </div>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0, background: 'transparent' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Agent</th>
                  <th style={{ width: 36 }}>Dir</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                  <th>Recording</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : recordings.map((rec) => (
                      <tr key={rec.id}>
                        <td className="td-phone">{rec.contactNumber || '—'}</td>
                        <td style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {cleanAgentName(rec.agentName)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <DirIcon direction={rec.direction} />
                        </td>
                        <td style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text2)' }}>
                          {formatDuration(rec.durationSeconds)}
                        </td>
                        <td>
                          <StatusBadge status={rec.status} />
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                          {formatDateTime(rec.dateTime)}
                        </td>
                        <td>
                          <PlayCell
                            url={rec.recordingUrl}
                            isOpen={openId === rec.id}
                            onOpen={() => setOpenId(rec.id)}
                            onClose={() => setOpenId(null)}
                          />
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
