import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, TrendingUp, Users, Calendar, DollarSign, Zap } from 'lucide-react';
import api from '../utils/api';

// ─── Animation keyframes (injected once into the document) ────────────────────
const INJECTED_STYLES = `
@keyframes kpiFlash {
  0%   { box-shadow: 0 0 0 0   rgba(0,229,160,0.5); border-color: var(--primary); }
  50%  { box-shadow: 0 0 0 6px rgba(0,229,160,0.0); }
  100% { box-shadow: none; }
}
@keyframes activityIn {
  from { opacity: 0; transform: translateY(-5px); background: rgba(0,229,160,0.09); }
  60%  { background: rgba(0,229,160,0.04); }
  to   { opacity: 1; transform: translateY(0);    background: transparent; }
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 45)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const EVENT_META = {
  call_started:  { icon: '📞', color: 'var(--text3)',   sentence: e => `started a call with ${e.leadName || e.leadPhone || 'a lead'}` },
  call_ended:    { icon: '☎️',  color: 'var(--text3)',   sentence: e => `ended a call${e.leadName ? ` with ${e.leadName}` : ''}${e.detail ? ` · ${e.detail}` : ''}` },
  interested:    { icon: '🟢', color: 'var(--primary)', sentence: e => `marked ${e.leadName || 'a lead'} as Interested` },
  demo_booked:   { icon: '📅', color: 'var(--purple)',  sentence: e => `booked a demo with ${e.leadName || 'a lead'}` },
  callback:      { icon: '🔄', color: 'var(--blue)',    sentence: e => `scheduled callback for ${e.leadName || 'a lead'}` },
  not_qualified: { icon: '❌', color: 'var(--red)',     sentence: e => `marked ${e.leadName || 'a lead'} as Not Qualified` },
  no_answer:     { icon: '📵', color: 'var(--text3)',   sentence: e => `got no answer from ${e.leadName || e.leadPhone || 'a lead'}` },
  voicemail:     { icon: '📬', color: 'var(--text3)',   sentence: e => `left voicemail for ${e.leadName || 'a lead'}` },
  closed:        { icon: '💰', color: 'var(--gold)',    sentence: e => `closed ${e.leadName || 'a lead'}` },
  email_sent:    { icon: '📧', color: 'var(--blue)',    sentence: e => `sent email to ${e.leadName || 'a lead'}` },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Smoothly counts up/down to `target` when it changes.
function useCountUp(target, duration = 550) {
  const [displayed, setDisplayed] = useState(target);
  const prevRef  = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    const start = Date.now();
    const diff  = target - from;

    const tick = () => {
      const t      = Math.min((Date.now() - start) / duration, 1);
      const eased  = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setDisplayed(Math.round(from + diff * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(target);
        prevRef.current = target;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return displayed;
}

// Returns true for ~1.2 s whenever `value` changes (skip initial mount).
function useFlash(value) {
  const [flashing, setFlashing] = useState(false);
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), 1200);
    return () => clearTimeout(t);
  }, [value]);
  return flashing;
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
// rawValue drives count-up + flash. displayValue, when set, replaces the
// animated number (used for formatted strings like "$1,247").

function KpiCard({ label, rawValue = 0, displayValue, color = 'primary', icon: Icon }) {
  const animated = useCountUp(rawValue);
  const flashing = useFlash(rawValue);

  const palette = {
    primary: { num: 'var(--primary)', bg: 'var(--primary-dim)' },
    gold:    { num: 'var(--gold)',    bg: 'var(--gold-dim)' },
    purple:  { num: 'var(--purple)',  bg: 'var(--purple-dim)' },
    blue:    { num: 'var(--blue)',    bg: 'var(--blue-dim)' },
  };
  const c = palette[color] || palette.primary;

  return (
    <div
      className="panel"
      style={{
        flex: 1, minWidth: 160,
        animation: flashing ? 'kpiFlash 1.2s ease-out forwards' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </div>
        {Icon && (
          <div style={{ width: 28, height: 28, borderRadius: 6, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={13} color={c.num} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 32, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: c.num, lineHeight: 1 }}>
        {displayValue ?? animated}
      </div>
    </div>
  );
}

// ─── Agent status pill ────────────────────────────────────────────────────────

function StatusPill({ status, currentLead }) {
  if (status === 'on_call') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--primary)', flexShrink: 0,
          animation: 'pulse 1.2s ease-in-out infinite',
          display: 'inline-block',
        }} />
        <span style={{
          fontSize: 10, color: 'var(--primary)', fontWeight: 600,
          maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          On call{currentLead ? ` — ${currentLead}` : ''}
        </span>
      </div>
    );
  }
  if (status === 'idle') {
    return (
      <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1, display: 'block' }}>
        ⚪ Idle
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10, color: 'var(--text3)', opacity: 0.55, marginTop: 1, display: 'block' }}>
      🌙 Away
    </span>
  );
}

// ─── Agent leaderboard card ───────────────────────────────────────────────────

function AgentCard({ agent }) {
  const pct      = (n, total) => total === 0 ? 0 : Math.round((n / total) * 100);
  const total    = agent.totalLeads || 1;
  const isOnCall = agent.status === 'on_call';

  return (
    <div
      className="panel"
      style={{
        flex: 1, minWidth: 200,
        borderColor: isOnCall ? 'var(--primary)' : 'var(--border2)',
        transition: 'border-color 0.4s ease',
      }}
    >
      {/* Header: avatar + name/status + lead count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: isOnCall ? 'var(--primary-dim)' : 'var(--bg4)',
            border: `2px solid ${isOnCall ? 'var(--primary)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 12,
            color: isOnCall ? 'var(--primary)' : 'var(--text2)',
            transition: 'border-color 0.3s, color 0.3s',
          }}>
            {agent.name[0]}
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>
              {agent.name}
            </div>
            <StatusPill status={agent.status} currentLead={agent.currentLead} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
            {agent.totalLeads}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>total leads</div>
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Interested', val: agent.interested, color: 'var(--primary)' },
          { label: 'Demo',       val: agent.demoBooked, color: 'var(--purple)' },
          { label: 'Closed',     val: agent.closed,     color: 'var(--gold)' },
          { label: 'Callback',   val: agent.callback,   color: 'var(--blue)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
              {val}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Conversion bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { label: 'Interested', val: agent.interested, color: 'var(--primary)' },
          { label: 'Demo',       val: agent.demoBooked, color: 'var(--purple)' },
          { label: 'Closed',     val: agent.closed,     color: 'var(--gold)' },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>
              <span>{label}</span><span>{pct(val, total)}%</span>
            </div>
            <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2 }}>
              <div style={{ width: `${pct(val, total)}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Today's activity */}
      {(agent.callsToday > 0 || agent.talkTimeMinutes > 0) && (
        <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
              {agent.callsToday}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>calls today</div>
          </div>
          {agent.talkTimeMinutes > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>
                {agent.talkTimeMinutes}m
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>talk time</div>
            </div>
          )}
          {agent.conversionRate > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', fontFamily: "'Syne', sans-serif" }}>
                {agent.conversionRate}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>conv.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline bar ─────────────────────────────────────────────────────────────

function PipelineBar({ label, count, max, color }) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 90, fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ width: 30, fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text)', textAlign: 'right', flexShrink: 0 }}>
        {count}
      </div>
    </div>
  );
}

// ─── 7-day conversion chart (loaded once, not on 5s poll) ────────────────────

function ConversionChart({ data }) {
  if (!data) return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-head"><div className="panel-title">7-Day Conversions</div></div>
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>Loading…</div>
    </div>
  );
  const { days, conversionRate, totalDemos } = data;
  const maxCount = Math.max(...days.map(d => d.count), 1);
  const H = 120;
  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-head">
        <div className="panel-title">7-Day Conversions</div>
        <span style={{ fontSize: 11, color: 'var(--primary)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
          {conversionRate}% avg rate
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: H, marginBottom: 6 }}>
        {days.map(({ day, count }) => {
          const barH = Math.max(4, Math.round((count / maxCount) * H));
          return (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              {count > 0 && <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{count}</div>}
              <div style={{ width: '100%', height: barH, flexShrink: 0, borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease',
                background: count > 0 ? 'linear-gradient(to top, var(--primary), rgba(0,229,160,0.25))' : 'var(--bg4)' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {days.map(({ day }) => (
          <div key={day} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text3)' }}>{day}</div>
        ))}
      </div>
      <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
        Avg: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{conversionRate}%</span>
        {' · '}{totalDemos} demo{totalDemos !== 1 ? 's' : ''} total
      </div>
    </div>
  );
}

// ─── Phone status (static) ───────────────────────────────────────────────────

const AGENT_NUMBERS = [
  { name: 'Lucas', number: '+1 (831) 480-3557' },
  { name: 'Harry', number: '+1 (831) 231-2281' },
  { name: 'Jim',   number: '+1 (831) 337-0742' },
  { name: 'Bruce', number: '+1 (831) 401-4983' },
];

function PhoneStatusPanel() {
  return (
    <div className="panel" style={{ width: 280, flexShrink: 0 }}>
      <div className="panel-head">
        <div className="panel-title">📞 Phone Status</div>
        <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>connected via webhook</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {AGENT_NUMBERS.map(({ name, number }) => (
          <div key={name} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg3)', borderRadius: 6, padding: '8px 12px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: 'var(--text2)' }}>{number}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity feed row ────────────────────────────────────────────────────────

function ActivityRow({ event, isNew }) {
  const meta = EVENT_META[event.type] || {
    icon: '•', color: 'var(--text3)',
    sentence: e => e.type,
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 0', borderBottom: '1px solid var(--border)',
      animation: isNew ? 'activityIn 1.6s ease-out forwards' : 'none',
    }}>
      <div style={{ fontSize: 15, flexShrink: 0, marginTop: 0, lineHeight: 1.4 }}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text)' }}>
          <span style={{ fontWeight: 600 }}>{event.agent}</span>
          {' '}
          <span style={{ color: meta.color }}>{meta.sentence(event)}</span>
        </div>
      </div>
      <div style={{
        fontSize: 10, color: 'var(--text3)', flexShrink: 0, marginTop: 2,
        fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap',
      }}>
        {timeAgo(event.timestamp)}
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [kpis, setKpis]               = useState(null);
  const [agents, setAgents]           = useState([]);
  const [conversionData, setConversionData] = useState(null);
  const [pipelineStats, setPipelineStats]   = useState(null);
  const [activity, setActivity]       = useState([]);
  const [newIds, setNewIds]           = useState(new Set());
  const [pollOk, setPollOk]           = useState(true);
  const [lastPollAt, setLastPollAt]   = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Tracks the newest event timestamp seen — used for delta ?since= polling
  const lastSinceRef = useRef(null);

  // ── /dashboard/live — KPIs + agent status ─────────────────────────────────
  const pollLive = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/live');
      setKpis(prev => {
        // Only update state when values actually differ (prevents unnecessary re-renders)
        if (
          prev &&
          prev.totalLeads   === data.kpis.totalLeads   &&
          prev.interested   === data.kpis.interested   &&
          prev.demoBooked   === data.kpis.demoBooked   &&
          prev.closed       === data.kpis.closed       &&
          prev.pipelineValue=== data.kpis.pipelineValue
        ) return prev;
        return data.kpis;
      });
      setAgents(data.agents || []);
      setPollOk(true);
      setLastPollAt(new Date());
      setInitialLoad(false);
    } catch (err) {
      console.error('[DASHBOARD/LIVE]', err.message);
      setPollOk(false);
    }
  }, []);

  // ── /dashboard/activity — event feed ──────────────────────────────────────
  const pollActivity = useCallback(async () => {
    try {
      const since = lastSinceRef.current;
      const qs    = since ? `?since=${encodeURIComponent(since)}` : '?limit=30';
      const { data } = await api.get(`/dashboard/activity${qs}`);
      const incoming = data.events || [];

      if (incoming.length > 0) {
        lastSinceRef.current = incoming[0].timestamp; // newest is first
        const ids = new Set(incoming.map(e => e.id));
        setNewIds(ids);
        setTimeout(() => setNewIds(new Set()), 2500);
        setActivity(prev => {
          const merged = [...incoming, ...prev];
          const seen   = new Set();
          return merged
            .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
            .slice(0, 30);
        });
      }
    } catch (err) {
      console.error('[DASHBOARD/ACTIVITY]', err.message);
    }
  }, []);

  // ── One-time: load conversion chart + pipeline bars ────────────────────────
  useEffect(() => {
    Promise.allSettled([
      api.get('/stats/conversion'),
      api.get('/stats/team'),
    ]).then(([convR, teamR]) => {
      if (convR.status === 'fulfilled') setConversionData(convR.value.data);
      if (teamR.status === 'fulfilled') setPipelineStats(teamR.value.data.stats);
    });
  }, []);

  // ── 5-second polling ───────────────────────────────────────────────────────
  useEffect(() => {
    pollLive();
    pollActivity();
    const t1 = setInterval(pollLive,     5_000);
    const t2 = setInterval(pollActivity, 5_000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [pollLive, pollActivity]);

  // ── Pipeline bar items ─────────────────────────────────────────────────────
  const pipelineItems = pipelineStats ? [
    { label: 'New',           count: pipelineStats.new,          color: 'var(--text3)' },
    { label: 'Called',        count: pipelineStats.called,       color: 'var(--blue)' },
    { label: 'No Answer',     count: pipelineStats.noAnswer,     color: 'var(--text2)' },
    { label: 'Voicemail',     count: pipelineStats.voicemail,    color: 'var(--text2)' },
    { label: 'Callback',      count: pipelineStats.callback,     color: 'var(--gold)' },
    { label: 'Interested',    count: pipelineStats.interested,   color: 'var(--primary)' },
    { label: 'Demo Booked',   count: pipelineStats.demosBooked,  color: 'var(--purple)' },
    { label: 'Closed',        count: pipelineStats.closed,       color: 'var(--gold)' },
    { label: 'Not Qualified', count: pipelineStats.notQualified, color: 'var(--red)' },
  ] : [];
  const pipelineMax = pipelineItems.length ? Math.max(...pipelineItems.map(i => i.count), 1) : 1;

  const onCallCount = agents.filter(a => a.status === 'on_call').length;

  // ── Initial spinner ────────────────────────────────────────────────────────
  if (initialLoad) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--text3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading dashboard…
      </div>
    );
  }

  return (
    <>
      <style>{INJECTED_STYLES}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <h1 className="page-h1">Dashboard</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: pollOk ? 'var(--primary)' : 'var(--red)',
              animation: pollOk ? 'pulse 2s ease-in-out infinite' : 'none',
            }} />
            {lastPollAt ? `Updated ${timeAgo(lastPollAt.toISOString())}` : 'Loading…'}
            {' · '}
            {pollOk ? 'live · 5s refresh' : 'poll failed — retrying'}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => { pollLive(); pollActivity(); }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      {kpis && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <KpiCard label="Total Leads"    rawValue={kpis.totalLeads}    color="primary" icon={Users} />
          <KpiCard label="Interested"     rawValue={kpis.interested}    color="primary" icon={TrendingUp} />
          <KpiCard label="Demo Booked"    rawValue={kpis.demoBooked}    color="purple"  icon={Calendar} />
          <KpiCard label="Closed"         rawValue={kpis.closed}        color="gold"    icon={Zap} />
          <KpiCard
            label="Pipeline Value"
            rawValue={kpis.pipelineValue}
            displayValue={`$${(kpis.pipelineValue || 0).toLocaleString()}`}
            color="gold"
            icon={DollarSign}
          />
        </div>
      )}

      {/* ── Agent leaderboard ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Agent Leaderboard</div>
          {onCallCount > 0 && (
            <span style={{
              fontSize: 10, color: 'var(--primary)', background: 'var(--primary-dim)',
              padding: '2px 8px', borderRadius: 100, fontWeight: 600,
            }}>
              {onCallCount} on call
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {agents.length === 0
            ? <div className="panel" style={{ width: '100%', color: 'var(--text3)', textAlign: 'center', padding: 24 }}>No agent data yet</div>
            : agents.map(a => <AgentCard key={a.name} agent={a} />)
          }
        </div>
      </div>

      {/* ── Chart + phone row ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
        <ConversionChart data={conversionData} />
        <PhoneStatusPanel />
      </div>

      {/* ── Bottom: pipeline bars + live activity ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Pipeline Status */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Pipeline Status</div>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
              {pipelineStats?.totalLeads ?? kpis?.totalLeads ?? 0} total
            </span>
          </div>
          {pipelineItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pipelineItems.map(item => <PipelineBar key={item.label} {...item} max={pipelineMax} />)}
            </div>
          ) : (
            <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Loading…</div>
          )}
        </div>

        {/* Live Activity Feed */}
        <div className="panel" style={{ maxHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-head" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div className="panel-title">Live Activity</div>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
                background: pollOk ? 'var(--primary)' : 'var(--red)',
                animation: pollOk ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>
              {activity.length > 0 ? `${activity.length} events` : 'waiting for activity…'}
            </span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {activity.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '28px 0', fontSize: 13 }}>
                No activity yet — outcomes will appear here in real time.
              </div>
            ) : (
              activity.map(event => (
                <ActivityRow key={event.id} event={event} isNew={newIds.has(event.id)} />
              ))
            )}
          </div>
        </div>

      </div>
    </>
  );
}
