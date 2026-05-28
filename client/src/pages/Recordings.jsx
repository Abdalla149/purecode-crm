import { useState, useEffect } from 'react';
import { Mic, RefreshCw, Play, Search, X } from 'lucide-react';
import api from '../utils/api';

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const s = parseInt(seconds, 10);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const DIR_STYLE = {
  inbound: {
    background: 'rgba(0,229,160,0.12)',
    color: 'var(--primary)',
  },
  outbound: {
    background: 'rgba(120,120,255,0.12)',
    color: 'var(--purple)',
  },
};

export default function Recordings() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  // Filter state
  const [agentInput, setAgentInput] = useState('');
  const [fromInput, setFromInput]   = useState('');
  const [toInput, setToInput]       = useState('');

  // Active filters (applied on fetch)
  const [activeAgent, setActiveAgent] = useState('');
  const [activeFrom, setActiveFrom]   = useState('');
  const [activeTo, setActiveTo]       = useState('');

  const hasFilter = activeAgent || activeFrom || activeTo;

  async function fetchRecordings(agent = activeAgent, from = activeFrom, to = activeTo) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (agent) params.set('agent', agent);
      if (from)  params.set('from', from);
      if (to)    params.set('to', to);
      const qs = params.toString();
      const { data } = await api.get(`/recordings${qs ? `?${qs}` : ''}`);
      setRecordings(data.recordings || []);
    } catch (err) {
      const msg = err.response?.data?.error || 'Something went wrong — contact David';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecordings(); }, []);

  function handleFilter(e) {
    e.preventDefault();
    setActiveAgent(agentInput);
    setActiveFrom(fromInput);
    setActiveTo(toInput);
    fetchRecordings(agentInput, fromInput, toInput);
  }

  function handleClear() {
    setAgentInput('');
    setFromInput('');
    setToInput('');
    setActiveAgent('');
    setActiveFrom('');
    setActiveTo('');
    fetchRecordings('', '', '');
  }

  const subtitle = loading
    ? 'Loading…'
    : error
      ? 'Error loading recordings'
      : `${recordings.length} recording${recordings.length !== 1 ? 's' : ''}${hasFilter ? ' (filtered)' : ''}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Recordings</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => fetchRecordings()} disabled={loading}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <form
        onSubmit={handleFilter}
        style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.05em' }}>
            AGENT
          </label>
          <input
            className="input"
            style={{ width: 160, padding: '6px 10px' }}
            placeholder="e.g. Lucas"
            value={agentInput}
            onChange={e => setAgentInput(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.05em' }}>
            FROM
          </label>
          <input
            type="date"
            className="input"
            style={{ padding: '6px 10px' }}
            value={fromInput}
            onChange={e => setFromInput(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.05em' }}>
            TO
          </label>
          <input
            type="date"
            className="input"
            style={{ padding: '6px 10px' }}
            value={toInput}
            onChange={e => setToInput(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ height: 34, padding: '0 14px' }}
          disabled={loading}
        >
          <Search size={12} /> Filter
        </button>
        {hasFilter && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: 34, padding: '0 12px' }}
            onClick={handleClear}
          >
            <X size={12} /> Clear
          </button>
        )}
      </form>

      {error && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)',
          borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
          <div style={{
            width: 16, height: 16,
            border: '2px solid var(--text3)', borderTopColor: 'var(--primary)',
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
          Loading recordings…
        </div>
      ) : recordings.length === 0 ? (
        <div className="placeholder-wrap" style={{ marginTop: 8 }}>
          <Mic size={32} color="var(--text3)" />
          <div className="placeholder-title">No recordings found</div>
          <p className="placeholder-sub">
            {hasFilter
              ? 'Try adjusting your filters.'
              : 'Calls with recordings will appear here once calls are made.'}
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-head" style={{ padding: '14px 18px 0' }}>
            <div className="panel-title">Call Recordings</div>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
              {recordings.length} total
            </span>
          </div>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0, background: 'transparent' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Agent</th>
                  <th>Contact</th>
                  <th>From #</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Dir</th>
                  <th>Play</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((rec, idx) => {
                  const dirStyle = DIR_STYLE[rec.direction?.toLowerCase()] || {};
                  return (
                    <tr key={rec.id || idx}>
                      <td className="td-mono" style={{ color: 'var(--text3)' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                        {rec.agentName || '—'}
                      </td>
                      <td className="td-phone">{rec.contactNumber || '—'}</td>
                      <td className="td-phone" style={{ color: 'var(--text3)' }}>
                        {rec.justcallNumber || '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {formatDateTime(rec.dateTime)}
                      </td>
                      <td style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text2)' }}>
                        {formatDuration(rec.durationSeconds)}
                      </td>
                      <td>
                        {rec.direction && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px',
                            borderRadius: 100, textTransform: 'uppercase',
                            ...dirStyle,
                          }}>
                            {rec.direction}
                          </span>
                        )}
                      </td>
                      <td>
                        <a
                          href={rec.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 600, color: 'var(--primary)',
                            background: 'var(--primary-dim)', padding: '3px 10px',
                            borderRadius: 100, textDecoration: 'none',
                          }}
                        >
                          <Play size={9} /> Play
                        </a>
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
