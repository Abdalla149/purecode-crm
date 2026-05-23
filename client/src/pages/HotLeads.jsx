import { useState, useEffect, useMemo } from 'react';
import { Phone, RefreshCw, Mail, Send } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter, useDroppable, useDraggable } from '@dnd-kit/core';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import CallWorkspace from '../components/CallWorkspace';
import WelcomeEmailPanel from '../components/WelcomeEmailPanel';
import FollowUpEmailPanel from '../components/FollowUpEmailPanel';
import NextActionBadge from '../components/NextActionBadge';
import { useCallQueue } from '../hooks/useCallQueue';
import { formatGoogleScore } from '../utils/leads';
import { getLeadColumn, COLUMN_STATUS } from '../utils/next_action';

// ── Column definitions ────────────────────────────────────────
const COLUMNS = [
  { id: 'called',     emoji: '📞', title: 'Called',        color: 'var(--text3)' },
  { id: 'interested', emoji: '💬', title: 'Interested',    color: 'var(--primary)' },
  { id: 'email',      emoji: '📧', title: 'Email Opened',  color: 'var(--blue)' },
  { id: 'demo',       emoji: '📅', title: 'Demo Booked',   color: 'var(--purple)' },
  { id: 'closed',     emoji: '💰', title: 'Closed / Paid', color: 'var(--gold)' },
  { id: 'lost',       emoji: '❌', title: 'Lost',          color: 'var(--red)' },
];

// ── Agent avatar colors ────────────────────────────────────────
const AGENT_COLORS = {
  lucas: '#00e5a0', harry: '#a78bfa', jim: '#4ea8de', bruce: '#f5c842', david: '#ff6b35',
};

function agentInitial(name) { return (name || '?').charAt(0).toUpperCase(); }
function agentColor(name)   { return AGENT_COLORS[(name || '').toLowerCase()] || 'var(--text3)'; }

// ── Relative time ──────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return null;
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Draggable Card ─────────────────────────────────────────────
function KanbanCard({ lead, agentName, onCall, onWelcome, onFollowUp, onNextAction, isDragging }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const gScore = formatGoogleScore(lead.googleScore);
  const lastAct = relativeTime(lead.lastActivity || lead.dateAdded);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`kcard${isDragging ? ' kcard-dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="kcard-name">{lead.name}</div>

      {lead.phone && (
        <div className="kcard-phone">{lead.phone}</div>
      )}

      {(lead.city || lead.state) && (
        <div className="kcard-meta">
          📍 {[lead.city, lead.state].filter(Boolean).join(', ')}
        </div>
      )}

      {gScore && (
        <div className="kcard-google">{gScore}</div>
      )}

      <div className="kcard-row">
        {agentName && (
          <div className="kcard-agent">
            <span className="kcard-av" style={{ background: agentColor(agentName) }}>
              {agentInitial(agentName)}
            </span>
            <span className="kcard-agent-name">{agentName}</span>
          </div>
        )}
        {lastAct && <span className="kcard-time">{lastAct}</span>}
      </div>

      <div className="kcard-na" onClick={e => e.stopPropagation()}>
        <NextActionBadge lead={lead} onClick={onNextAction} />
      </div>

      {/* Action buttons */}
      <div className="kcard-actions" onClick={e => e.stopPropagation()}>
        <button
          className="kcard-btn kcard-btn-call"
          title="Call now"
          onClick={() => onCall(lead)}
          disabled={!lead.phone}
        >
          <Phone size={11} />
        </button>
        <button
          className="kcard-btn kcard-btn-email"
          title="Send welcome email"
          onClick={() => onWelcome(lead)}
        >
          <Mail size={11} />
        </button>
        <button
          className="kcard-btn kcard-btn-followup"
          title="Send follow-up"
          onClick={() => onFollowUp(lead)}
        >
          <Send size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Overlay card (shown while dragging) ───────────────────────
function KanbanCardOverlay({ lead }) {
  const gScore = formatGoogleScore(lead.googleScore);
  return (
    <div className="kcard kcard-overlay">
      <div className="kcard-name">{lead.name}</div>
      {lead.phone && <div className="kcard-phone">{lead.phone}</div>}
      {gScore && <div className="kcard-google">{gScore}</div>}
    </div>
  );
}

// ── Droppable Column ───────────────────────────────────────────
function KanbanColumn({ col, leads, agentNames, onCall, onWelcome, onFollowUp, onNextAction, activeDragId }) {
  const { isOver, setNodeRef } = useDroppable({ id: col.id });

  const isPlaceholder = col.id === 'email';

  return (
    <div className={`kcol${isOver ? ' kcol-over' : ''}`}>
      <div className="kcol-head">
        <span style={{ color: col.color }}>{col.emoji}</span>
        <span className="kcol-title">{col.title}</span>
        <span className="kcol-count">{leads.length}</span>
      </div>

      <div ref={setNodeRef} className="kcol-body">
        {isPlaceholder ? (
          <div className="kcol-placeholder">
            <p>Auto-populated when the email-opened webhook fires in Phase 2</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="kcol-empty">No leads here yet</div>
        ) : (
          leads.map(lead => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              agentName={agentNames[lead.assignedAgent]}
              onCall={onCall}
              onWelcome={onWelcome}
              onFollowUp={onFollowUp}
              onNextAction={onNextAction}
              isDragging={lead.id === activeDragId}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
function KanbanSkeleton() {
  return (
    <div className="kanban-board">
      {COLUMNS.map(col => (
        <div key={col.id} className="kcol">
          <div className="kcol-head">
            <span>{col.emoji}</span>
            <span className="kcol-title">{col.title}</span>
          </div>
          <div className="kcol-body">
            {[1, 2].map(i => (
              <div key={i} className="kcard kcard-skeleton">
                <div className="kskel-line kskel-name" />
                <div className="kskel-line kskel-phone" />
                <div className="kskel-line kskel-meta" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function HotLeads() {
  const { user }          = useAuth();
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('all');
  const [activeDragId, setActiveDragId] = useState(null);
  const [toast, setToast] = useState(null);
  const [welcomeLead,  setWelcomeLead]  = useState(null);
  const [followUpLead, setFollowUpLead] = useState(null);

  const {
    activeCall, saving,
    handleStartCall, handleOutcome,
    dialWarning,
  } = useCallQueue();

  // ── Data ──────────────────────────────────────────────────
  async function fetchLeads() {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data.leads || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchLeads(); }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/auth/agents').then(r => setAgents(r.data.agents || [])).catch(() => {});
  }, [user?.role]);

  // ── Agent name lookup ─────────────────────────────────────
  const agentNames = useMemo(() => {
    const map = {};
    agents.forEach(a => { map[a.ghlUserId] = a.name; });
    return map;
  }, [agents]);

  // ── Filter & column bucketing ─────────────────────────────
  const pipelineLeads = useMemo(() => {
    let filtered = leads.filter(l => getLeadColumn(l) !== null);
    if (agentFilter !== 'all' && user?.role === 'admin') {
      filtered = filtered.filter(l => l.assignedAgent === agentFilter);
    }
    return filtered;
  }, [leads, agentFilter, user?.role]);

  const columnLeads = useMemo(() => {
    const map = {};
    COLUMNS.forEach(c => { map[c.id] = []; });
    pipelineLeads.forEach(lead => {
      const col = getLeadColumn(lead);
      if (col && map[col]) map[col].push(lead);
    });
    return map;
  }, [pipelineLeads]);

  // ── Pipeline summary stats ────────────────────────────────
  const stats = useMemo(() => ({
    total:   pipelineLeads.length,
    called:  columnLeads['called']?.length    || 0,
    interested: columnLeads['interested']?.length || 0,
    demo:    columnLeads['demo']?.length      || 0,
    closed:  columnLeads['closed']?.length    || 0,
    revenue: (columnLeads['closed']?.length || 0) * 497,
  }), [columnLeads, pipelineLeads.length]);

  // ── Toast helper ──────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToast(null), 3000);
  }

  // ── Drag handlers ─────────────────────────────────────────
  function onDragStart({ active }) {
    setActiveDragId(active.id);
  }

  async function onDragEnd({ active, over }) {
    setActiveDragId(null);
    if (!over || active.id === over.id) return;

    const newColId = over.id;
    const newStatus = COLUMN_STATUS[newColId];
    if (!newStatus) return; // email column is placeholder

    const lead = active.data.current?.lead;
    if (!lead) return;

    const currentCol = getLeadColumn(lead);
    if (currentCol === newColId) return;

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === lead.id ? { ...l, status: newStatus, lastOutcome: newStatus } : l
    ));

    const colTitle = COLUMNS.find(c => c.id === newColId)?.title || newColId;
    showToast(`Moved ${lead.name} → ${colTitle}`);

    try {
      await api.post(`/leads/${lead.id}/note`, { text: '', outcome: newStatus });
    } catch {
      // Revert on failure
      setLeads(prev => prev.map(l =>
        l.id === lead.id ? { ...l, status: lead.status, lastOutcome: lead.lastOutcome } : l
      ));
    }
  }

  // ── Next action badge click handler ───────────────────────
  function handleNextAction(action, lead) {
    if (action === 'welcome')   { setWelcomeLead(lead);  return; }
    if (action === 'followup')  { setFollowUpLead(lead); return; }
    if (action === 'call')      { handleStartCall(lead); return; }
    if (action === 'demo-prep') { showToast('Demo prep checklist coming soon'); return; }
    if (action === 'notify')    { showToast('David has been notified'); return; }
  }

  // ── Welcome email callback ────────────────────────────────
  function onWelcomeSent(leadId) {
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, status: 'Interested', tags: [...(l.tags || []), 'welcome-email-sent'] }
        : l
    ));
    showToast('Welcome email sent — lead moved to Interested');
  }

  // ── Follow-up callback ────────────────────────────────────
  function onFollowUpSent(leadId) {
    showToast('Follow-up email logged — Zoho send wiring coming in Phase 3');
  }

  // ── Active call → workspace ───────────────────────────────
  function onCallOutcome(leadId, status) {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, status, lastOutcome: status } : l
    ));
  }

  if (activeCall) {
    return (
      <CallWorkspace
        lead={activeCall.lead}
        agentName={user?.name || 'Agent'}
        onOutcome={(outcome, note) => handleOutcome(outcome, note, onCallOutcome)}
        saving={saving}
        queueStats={null}
        nextLeads={[]}
      />
    );
  }

  const activeLead = activeDragId
    ? leads.find(l => l.id === activeDragId) || null
    : null;

  return (
    <>
      {toast && <div className="toast-notification">{toast}</div>}

      {welcomeLead && (
        <WelcomeEmailPanel
          lead={welcomeLead}
          onClose={() => setWelcomeLead(null)}
          onSent={onWelcomeSent}
        />
      )}

      {followUpLead && (
        <FollowUpEmailPanel
          lead={followUpLead}
          onClose={() => setFollowUpLead(null)}
          onSent={onFollowUpSent}
        />
      )}

      {/* Dial warning */}
      {dialWarning && (
        <div className="dial-warning-bar">
          <Phone size={14} /> {dialWarning}
        </div>
      )}

      {/* Page header */}
      <div className="page-head">
        <div>
          <h1 className="page-h1">Sales Pipeline</h1>
          <p className="page-subtitle">
            {loading ? 'Loading…' : `${stats.total} leads in pipeline · $${stats.revenue.toLocaleString()} projected`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user?.role === 'admin' && agents.length > 0 && (
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 12 }}
            >
              <option value="all">All Agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.ghlUserId}>{a.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary" onClick={fetchLeads}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi blue">
          <div className="kpi-label">Pipeline</div>
          <div className="kpi-num">{stats.total}</div>
          <div className="kpi-delta flat">total</div>
        </div>
        <div className="kpi" style={{ '--kc': 'var(--text2)' }}>
          <div className="kpi-label">Called</div>
          <div className="kpi-num" style={{ color: 'var(--text2)' }}>{stats.called}</div>
          <div className="kpi-delta flat">reached</div>
        </div>
        <div className="kpi green">
          <div className="kpi-label">Interested</div>
          <div className="kpi-num">{stats.interested}</div>
          <div className="kpi-delta flat">warm</div>
        </div>
        <div className="kpi purple">
          <div className="kpi-label">Demo Booked</div>
          <div className="kpi-num">{stats.demo}</div>
          <div className="kpi-delta flat">scheduled</div>
        </div>
        <div className="kpi gold">
          <div className="kpi-label">Revenue</div>
          <div className="kpi-num">${(stats.revenue / 1000).toFixed(1)}k</div>
          <div className="kpi-delta flat">{stats.closed} closed × $497</div>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="kanban-board">
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                col={col}
                leads={columnLeads[col.id] || []}
                agentNames={agentNames}
                onCall={handleStartCall}
                onWelcome={setWelcomeLead}
                onFollowUp={setFollowUpLead}
                onNextAction={handleNextAction}
                activeDragId={activeDragId}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeLead && <KanbanCardOverlay lead={activeLead} />}
          </DragOverlay>
        </DndContext>
      )}
    </>
  );
}
