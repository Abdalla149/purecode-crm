import { useState, useEffect } from 'react';
import { Mic, RefreshCw, Play } from 'lucide-react';
import api from '../utils/api';

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const s = parseInt(seconds, 10);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function Recordings() {
  const [recordings, setRecordings] = useState([]);
  const [connected, setConnected]   = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  async function fetchRecordings() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/justcall/recordings');
      setRecordings(data.recordings || []);
      setConnected(data.connected === true);
    } catch {
      setError('Something went wrong — contact David');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecordings(); }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--text3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading recordings…
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Recordings</h1>
          <p className="page-subtitle">
            {!connected
              ? 'Phone system not connected'
              : recordings.length === 0
                ? 'No recordings yet'
                : `${recordings.length} recording${recordings.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchRecordings}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {(!connected || recordings.length === 0) ? (
        <div className="placeholder-wrap" style={{ marginTop: 8 }}>
          <Mic size={32} color="var(--text3)" />
          <div className="placeholder-title">No recordings yet</div>
          <p className="placeholder-sub">
            Recordings will appear here after the phone system is connected.
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
                  <th>Business</th>
                  <th>Phone</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Play</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((rec, idx) => (
                  <tr key={rec.id || idx}>
                    <td className="td-mono" style={{ color: 'var(--text3)' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="td-name">{rec.business || '—'}</td>
                    <td className="td-phone">{rec.to || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{formatDate(rec.timestamp)}</td>
                    <td style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text2)' }}>
                      {formatDuration(rec.duration)}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
