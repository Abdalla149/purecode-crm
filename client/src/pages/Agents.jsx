import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Users, ArrowRightLeft, UserX, RotateCcw, ExternalLink } from 'lucide-react';
import api from '../utils/api';

// ── Agent metadata (static — stats come from API) ────────────────
const AGENT_META = [
  {
    id:        'agent_lucas',
    name:      'Lucas',
    ghlUserId: '7c0sDQ3oEzttlQfa3jAA',
    email:     'lucas@purecode.agency',
    phone:     '+1 (831) 480-3557',
    color:     '#00e5a0',
    dim:       'rgba(0,229,160,0.10)',
    border:    'rgba(0,229,160,0.25)',
  },
  {
    id:        'agent_harry',
    name:      'Harry',
    ghlUserId: 'EFYhirIwNFKAY04HjbbK',
    email:     'harry@purecode.agency',
    phone:     '+1 (831) 231-2281',
    color:     '#a78bfa',
    dim:       'rgba(167,139,250,0.10)',
    border:    'rgba(167,139,250,0.25)',
  },
  {
    id:        'agent_jim',
    name:      'Jim',
    ghlUserId: 'CUqipGSIfqu2o7bcWroN',
    email:     'jim@purecode.agency',
    phone:     '+1 (831) 337-0742',
    color:     '#2dd4bf',
    dim:       'rgba(45,212,191,0.10)',
    border:    'rgba(45,212,191,0.25)',
  },
  {
    id:        'agent_bruce',
    name:      'Bruce',
    ghlUserId: 'hHYQ1Yk7EZhxjjFYYGln',
    email:     'bruce@purecode.agency',
    phone:     '+1 (831) 401-4983',
    color:     '#ff4d6a',
    dim:       'rgba(255,77,106,0.10)',
    border:    'rgba(255,77,106,0.25)',
  },
];

function pct(num, denom) {
  if (!denom) return '0%';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

// ── Stat chip inside a card ───────────────────────────────────────
function StatChip({ label, value, highlight }) {
  return (
    <div className="agent-stat-chip">
      <div className="agent-stat-val" style={highlight ? { color: highlight } : {}}>
        {value ?? '—'}
      </div>
      <div className="agent-stat-label">{label}</div>
    </div>
  );
}

// ── Confirmation / action modal ───────────────────────────────────
function Modal({ title, children, onClose, busy }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !busy) onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

// ── Single agent card ─────────────────────────────────────────────
function AgentCard({ meta, stats, onReassign, onUnassign }) {
  const navigate = useNavigate();

  const callsToday  = stats
    ? stats.called + stats.noAnswer + stats.voicemail + stats.callback +
      stats.interested + stats.demosBooked + stats.closed + stats.notQualified
    : null;
  const queueLeft   = stats ? stats.new + stats.called : null;
  const convPct     = stats ? pct(stats.closed, stats.totalLeads) : null;

  return (
    <div className="agent-card">
      {/* Header */}
      <div className="agent-card-head">
        <div
          className="agent-av"
          style={{ background: meta.dim, border: `2px solid ${meta.border}`, color: meta.color }}
        >
          {meta.name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div className="agent-card-name">{meta.name}</div>
          <div className="agent-card-email">{meta.email}</div>
          <div className="agent-card-phone">{meta.phone}</div>
        </div>
        {stats?.isActive && (
          <span className="agent-active-dot" title="On a call now" />
        )}
      </div>

      {/* Stats grid */}
      <div className="agent-stats-grid">
        <StatChip label="Total"     value={stats?.totalLeads} />
        <StatChip label="In Queue"  value={queueLeft}         />
        <StatChip label="Calls"     value={callsToday}        />
        <StatChip label="Demos"     value={stats?.demosBooked} highlight="var(--purple)" />
        <StatChip label="Interested" value={stats?.interested} highlight="var(--primary)" />
        <StatChip label="Closed"    value={stats?.closed}     highlight="var(--gold)" />
      </div>

      {/* Conversion */}
      <div className="agent-conv-row">
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>Conversion</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: meta.color }}>
          {convPct ?? '—'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="agent-card-actions">
        <button
          className="btn btn-secondary agent-btn"
          onClick={() => navigate(`/all-leads?assigned=${meta.ghlUserId}`)}
          title="View this agent's leads in All Leads"
        >
          <ExternalLink size={12} /> View Queue
        </button>
        <button
          className="btn btn-secondary agent-btn"
          onClick={() => onReassign(meta)}
          disabled={!stats?.totalLeads}
          title="Move all leads to another agent"
        >
          <ArrowRightLeft size={12} /> Reassign
        </button>
        <button
          className="btn btn-secondary agent-btn agent-btn-danger"
          onClick={() => onUnassign(meta, stats?.totalLeads ?? 0)}
          disabled={!stats?.totalLeads}
          title="Remove all assignments from this agent"
        >
          <UserX size={12} /> Unassign
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default function Agents() {
  const [stats,         setStats]         = useState(null);   // array from API
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [toast,         setToast]         = useState(null);
  const [modal,         setModal]         = useState(null);   // { type, agent?, total? }
  const [actionLoading, setActionLoading] = useState(false);
  const [reassignTo,    setReassignTo]    = useState('');
  const [resetConfirm,  setResetConfirm]  = useState('');     // typed confirmation

  const toastTimer = useState(null)[0]; // just a ref-like container

  function showToast(msg, isErr) {
    setToast({ msg, isErr });
    clearTimeout(window.__agentToastTimer);
    window.__agentToastTimer = setTimeout(() => setToast(null), 4000);
  }

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/stats/agents');
      setStats(data.agents || []);
    } catch {
      setError('Could not load agent stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Merge live stats into meta by ghlUserId
  function getMerged(meta) {
    return stats?.find(s => s.ghlUserId === meta.ghlUserId) ?? null;
  }

  const totalAssigned = stats ? stats.reduce((sum, s) => sum + (s.totalLeads || 0), 0) : null;

  // ── Modal actions ─────────────────────────────────────────────

  async function doReassign() {
    if (!reassignTo || !modal?.agent) return;
    setActionLoading(true);
    try {
      const { data } = await api.post('/leads/bulk-reassign-agent', {
        fromAgentId: modal.agent.ghlUserId,
        toAgentId:   reassignTo,
      });
      showToast(`${data.reassigned} leads moved to ${AGENT_META.find(a => a.ghlUserId === reassignTo)?.name}`);
      setModal(null);
      setReassignTo('');
      fetchStats();
    } catch {
      showToast('Reassign failed — contact David', true);
    } finally {
      setActionLoading(false);
    }
  }

  async function doUnassign() {
    if (!modal?.agent) return;
    setActionLoading(true);
    try {
      const { data } = await api.post('/leads/bulk-unassign-agent', {
        agentId: modal.agent.ghlUserId,
      });
      showToast(`${data.unassigned} leads unassigned from ${modal.agent.name}`);
      setModal(null);
      fetchStats();
    } catch {
      showToast('Unassign failed — contact David', true);
    } finally {
      setActionLoading(false);
    }
  }

  async function doResetAll() {
    if (resetConfirm !== 'RESET') return;
    setActionLoading(true);
    try {
      const { data } = await api.post('/leads/reset-all-agents');
      showToast(`${data.unassigned} leads unassigned from all agents`);
      setModal(null);
      setResetConfirm('');
      fetchStats();
    } catch {
      showToast('Reset failed — contact David', true);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`toast-notification${toast.isErr ? ' toast-err' : ''}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Modals ── */}

      {modal?.type === 'reassign' && (
        <Modal title={`Reassign all leads from ${modal.agent.name}`} onClose={() => setModal(null)} busy={actionLoading}>
          <p className="modal-body">
            Move all <strong>{modal.total}</strong> leads assigned to{' '}
            <strong>{modal.agent.name}</strong> to another agent.
          </p>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>Move to:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AGENT_META.filter(a => a.ghlUserId !== modal.agent.ghlUserId).map(a => (
                <label key={a.id} className={`agent-radio${reassignTo === a.ghlUserId ? ' selected' : ''}`}>
                  <input
                    type="radio" name="reassignTo" value={a.ghlUserId}
                    checked={reassignTo === a.ghlUserId}
                    onChange={() => setReassignTo(a.ghlUserId)}
                    style={{ display: 'none' }}
                  />
                  <span className="agent-radio-dot" style={{ borderColor: a.color, background: reassignTo === a.ghlUserId ? a.color : 'transparent' }} />
                  <span style={{ fontWeight: 600 }}>{a.name}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 11, marginLeft: 6 }}>
                    {getMerged(a)?.totalLeads ?? '?'} leads
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => { setModal(null); setReassignTo(''); }} disabled={actionLoading}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={doReassign}
              disabled={!reassignTo || actionLoading}
            >
              {actionLoading ? 'Moving…' : `Move ${modal.total} leads`}
            </button>
          </div>
        </Modal>
      )}

      {modal?.type === 'unassign' && (
        <Modal title={`Unassign all leads from ${modal.agent.name}?`} onClose={() => setModal(null)} busy={actionLoading}>
          <p className="modal-body">
            This will remove <strong>{modal.total}</strong> lead assignments from{' '}
            <strong>{modal.agent.name}</strong>. The leads remain in the pipeline unassigned.
          </p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setModal(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button className="btn modal-danger-btn" onClick={doUnassign} disabled={actionLoading}>
              {actionLoading ? 'Unassigning…' : `Unassign ${modal.total} leads`}
            </button>
          </div>
        </Modal>
      )}

      {modal?.type === 'reset' && (
        <Modal title="Reset all agents?" onClose={() => { setModal(null); setResetConfirm(''); }} busy={actionLoading}>
          <p className="modal-body">
            This will unassign <strong>{totalAssigned ?? '?'}</strong> leads from all 4 agents.
            Leads will remain in the pipeline as unassigned. This cannot be undone.
          </p>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
              Type <strong style={{ color: 'var(--red)', fontFamily: "'DM Mono', monospace" }}>RESET</strong> to confirm:
            </div>
            <input
              type="text"
              value={resetConfirm}
              onChange={e => setResetConfirm(e.target.value)}
              placeholder="RESET"
              autoFocus
              style={{
                background: 'var(--bg3)', border: `1px solid ${resetConfirm === 'RESET' ? 'var(--red)' : 'var(--border2)'}`,
                borderRadius: 6, color: 'var(--text)', padding: '8px 12px',
                fontSize: 13, fontFamily: "'DM Mono', monospace", width: '100%', boxSizing: 'border-box',
              }}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => { setModal(null); setResetConfirm(''); }} disabled={actionLoading}>
              Cancel
            </button>
            <button
              className="btn modal-danger-btn"
              onClick={doResetAll}
              disabled={resetConfirm !== 'RESET' || actionLoading}
            >
              {actionLoading ? 'Resetting…' : `Unassign all ${totalAssigned ?? '?'} leads`}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Page header ── */}
      <div className="page-head">
        <div>
          <h1 className="page-h1">Agents</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${totalAssigned ?? 0} leads assigned across ${AGENT_META.length} agents`}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStats} disabled={loading}>
          <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* ── Quick Actions strip ── */}
      <div className="quick-actions-strip">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', alignSelf: 'center' }}>
          Quick Actions
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => window.location.assign('/all-leads')}
          title="Go to All Leads to bulk-assign unassigned leads"
        >
          <Users size={13} /> Bulk Assign Leads
        </button>
        <button
          className="btn btn-secondary"
          style={{ color: 'var(--red)', borderColor: 'rgba(255,77,106,0.35)' }}
          onClick={() => setModal({ type: 'reset' })}
          disabled={!totalAssigned}
          title="Remove all agent assignments from all leads"
        >
          <RotateCcw size={13} /> Reset All Agents
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Agent cards grid ── */}
      {loading ? (
        <div className="agent-grid">
          {AGENT_META.map(a => (
            <div key={a.id} className="agent-card agent-card-skeleton">
              <div className="agent-skel-av" style={{ background: a.dim }} />
              <div className="agent-skel-lines">
                <div className="agent-skel-line" style={{ width: '60%' }} />
                <div className="agent-skel-line" style={{ width: '80%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="agent-grid">
          {AGENT_META.map(meta => (
            <AgentCard
              key={meta.id}
              meta={meta}
              stats={getMerged(meta)}
              onReassign={m => setModal({ type: 'reassign', agent: m, total: getMerged(m)?.totalLeads ?? 0 })}
              onUnassign={(m, total) => setModal({ type: 'unassign', agent: m, total })}
            />
          ))}
        </div>
      )}
    </>
  );
}
