import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, UserCheck, X, ChevronDown } from 'lucide-react';
import api from '../utils/api';
import { formatGoogleScore } from '../utils/leads';
import LeadPanel from '../components/LeadPanel';

const STATUSES = ['All', 'New', 'Called', 'No Answer', 'Voicemail', 'Callback', 'Interested', 'Demo Booked', 'Closed', 'Not Qualified'];

const STATUS_COLORS = {
  'New':           { bg: 'rgba(78,168,222,0.12)',  color: 'var(--blue)' },
  'Called':        { bg: 'rgba(138,135,128,0.12)', color: 'var(--text2)' },
  'No Answer':     { bg: 'rgba(74,72,69,0.25)',    color: 'var(--text3)' },
  'Voicemail':     { bg: 'rgba(74,72,69,0.25)',    color: 'var(--text3)' },
  'Callback':      { bg: 'rgba(245,200,66,0.12)',  color: 'var(--gold)' },
  'Interested':    { bg: 'rgba(0,229,160,0.12)',   color: 'var(--primary)' },
  'Demo Booked':   { bg: 'rgba(167,139,250,0.12)', color: 'var(--purple)' },
  'Closed':        { bg: 'rgba(245,200,66,0.15)',  color: 'var(--gold)' },
  'Not Qualified': { bg: 'rgba(255,77,106,0.12)',  color: 'var(--red)' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: 'var(--bg4)', color: 'var(--text2)' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
      background: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>{status}</span>
  );
}

function BulkAssignModal({ agents, onClose, onAssign }) {
  const [agentId, setAgentId]   = useState('');
  const [type, setType]         = useState('');
  const [tier, setTier]         = useState('');
  const [count, setCount]       = useState(25);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!agentId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await api.post('/leads/bulk-assign', {
        agentId,
        type: type || undefined,
        tier: tier || undefined,
        count: Number(count),
      });
      setResult(data);
      onAssign();
    } catch (err) {
      setError(err.response?.data?.error || 'Bulk assign failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 24, width: 420, maxWidth: '90vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>Bulk Assign Leads</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{result.assigned}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>leads assigned successfully</div>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Assign To *</label>
              <select
                value={agentId} onChange={e => setAgentId(e.target.value)}
                style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}
                required
              >
                <option value="">Select agent…</option>
                {agents.map(a => <option key={a.id} value={a.ghlUserId}>{a.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Business Type</label>
                <input
                  value={type} onChange={e => setType(e.target.value)}
                  placeholder="e.g. Roofing"
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Tier</label>
                <select
                  value={tier} onChange={e => setTier(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}
                >
                  <option value="">Any tier</option>
                  <option value="1">Tier 1</option>
                  <option value="2">Tier 2</option>
                  <option value="3">Tier 3</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Number of leads</label>
              <input
                type="number" min={1} max={200} value={count}
                onChange={e => setCount(e.target.value)}
                style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}
              />
            </div>

            {error && (
              <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 6, padding: '8px 12px', color: 'var(--red)', fontSize: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || !agentId}>
                {loading ? 'Assigning…' : 'Assign Leads'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ReassignDropdown({ lead, agents, onReassign }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function reassign(ghlUserId) {
    setOpen(false);
    setLoading(true);
    try {
      await api.put(`/leads/${lead.id}/assign`, { agentId: ghlUserId });
      onReassign(lead.id, ghlUserId);
    } catch {
      // silent — row still shows old agent
    } finally {
      setLoading(false);
    }
  }

  const currentAgent = agents.find(a => a.ghlUserId === lead.assignedAgent);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        style={{ fontSize: 10, padding: '3px 8px', gap: 4 }}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        disabled={loading}
      >
        <UserCheck size={10} />
        {loading ? '…' : (currentAgent?.name || 'Unassigned')}
        <ChevronDown size={9} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
          background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8,
          minWidth: 130, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div
            style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
            onClick={() => reassign('')}
          >Unassign</div>
          {agents.map(a => (
            <div
              key={a.id}
              style={{
                padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                color: a.ghlUserId === lead.assignedAgent ? 'var(--primary)' : 'var(--text)',
                background: a.ghlUserId === lead.assignedAgent ? 'var(--primary-dim)' : 'transparent',
              }}
              onClick={() => reassign(a.ghlUserId)}
            >
              {a.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AllLeads() {
  const [leads, setLeads]           = useState([]);
  const [agents, setAgents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showBulk, setShowBulk]     = useState(false);

  // Filters
  const [statusFilter, setStatusFilter]   = useState('All');
  const [agentFilter, setAgentFilter]     = useState('All');
  const [search, setSearch]               = useState('');
  const [cityFilter, setCityFilter]       = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== 'All') params.status = statusFilter;
      if (agentFilter !== 'All') params.assigned = agentFilter;
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get('/leads', { params });
      setLeads(data.leads || []);
    } catch {
      setError('Could not load leads');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, agentFilter, search]);

  useEffect(() => {
    api.get('/auth/agents')
      .then(r => setAgents(r.data.agents || []))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function handleReassign(leadId, ghlUserId) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assignedAgent: ghlUserId } : l));
  }

  const cities = [...new Set(leads.map(l => l.city).filter(Boolean))].sort();

  const filtered = cityFilter
    ? leads.filter(l => l.city === cityFilter)
    : leads;

  const agentName = (ghlUserId) => agents.find(a => a.ghlUserId === ghlUserId)?.name || '—';

  return (
    <>
      {showBulk && (
        <BulkAssignModal
          agents={agents}
          onClose={() => setShowBulk(false)}
          onAssign={() => { setShowBulk(false); fetchLeads(); }}
        />
      )}

      {selectedLead && (
        <LeadPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusUpdate={(id, status) => {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
            setSelectedLead(null);
          }}
        />
      )}

      <div className="page-head">
        <div>
          <h1 className="page-h1">All Leads</h1>
          <p className="page-subtitle">{filtered.length} leads{statusFilter !== 'All' ? ` · ${statusFilter}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={fetchLeads}><RefreshCw size={12} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowBulk(true)}><UserCheck size={12} /> Bulk Assign</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 260 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search business, phone…"
            style={{
              width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '7px 10px 7px 30px', color: 'var(--text)', fontSize: 12,
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 12 }}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>

        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 12 }}
        >
          <option value="All">All Agents</option>
          <option value="unassigned">Unassigned</option>
          {agents.map(a => <option key={a.id} value={a.ghlUserId}>{a.name}</option>)}
        </select>

        {cities.length > 0 && (
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 12 }}
          >
            <option value="">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {(statusFilter !== 'All' || agentFilter !== 'All' || cityFilter || search) && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '6px 10px', gap: 4 }}
            onClick={() => { setStatusFilter('All'); setAgentFilter('All'); setCityFilter(''); setSearch(''); }}
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 8, padding: '12px 16px', color: 'var(--red)', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 20 }}>
          <div style={{ width: 14, height: 14, border: '2px solid var(--text3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Loading leads…
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <div className="tbl-wrap" style={{ border: 'none', borderRadius: 0, background: 'transparent' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Business</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Google</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Agent</th>
                  <th style={{ textAlign: 'right' }}>Assign</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px 0', fontSize: 13 }}>
                      No leads match your filters
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead, idx) => (
                    <tr
                      key={lead.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="td-mono" style={{ color: 'var(--text3)' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="td-name">{lead.name}</td>
                      <td className="td-phone">{lead.phone || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.city || '—'}</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatGoogleScore(lead.googleScore) || <span style={{ color: 'var(--text3)', fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>{lead.businessType || '—'}</td>
                      <td><StatusBadge status={lead.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {agentName(lead.assignedAgent)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                          <ReassignDropdown lead={lead} agents={agents} onReassign={handleReassign} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
