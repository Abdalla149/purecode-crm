import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Users, Calendar, DollarSign, Activity, Zap, Radio } from 'lucide-react';
import api from '../utils/api';
import { useRealtimeFeed } from '../context/RealtimeFeed';

function KpiCard({ label, value, sub, color = 'primary', icon: Icon }) {
  const colors = {
    primary: { num: 'var(--primary)', bg: 'var(--primary-dim)' },
    gold:    { num: 'var(--gold)',    bg: 'var(--gold-dim)' },
    purple:  { num: 'var(--purple)',  bg: 'var(--purple-dim)' },
    blue:    { num: 'var(--blue)',    bg: 'var(--blue-dim)' },
  };
  const c = colors[color] || colors.primary;
  return (
    <div className="panel" style={{ flex: 1, minWidth: 160 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        {Icon && (
          <div style={{ width: 28, height: 28, borderRadius: 6, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={13} color={c.num} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 32, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: c.num, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function LiveDot({ active }) {
  if (!active) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)',
        animation: 'pulse 1.2s ease-in-out infinite',
        display: 'inline-block',
      }} />
      LIVE
    </span>
  );
}

function AgentCard({ agent }) {
  const pct = (n, total) => total === 0 ? 0 : Math.round((n / total) * 100);
  const total = agent.totalLeads || 1;
  return (
    <div className="panel" style={{ flex: 1, minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: agent.isActive ? 'var(--primary-dim)' : 'var(--bg4)',
            border: `2px solid ${agent.isActive ? 'var(--primary)' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 12,
            color: agent.isActive ? 'var(--primary)' : 'var(--text2)',
          }}>
            {agent.name[0]}
          </div>
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>{agent.name}</div>
            <LiveDot active={agent.isActive} />
            {!agent.isActive && <span style={{ fontSize: 10, color: 'var(--text3)' }}>idle</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{agent.totalLeads}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>total leads</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Interested', val: agent.interested, color: 'var(--primary)' },
          { label: 'Demo Booked', val: agent.demosBooked, color: 'var(--purple)' },
          { label: 'Closed', val: agent.closed, color: 'var(--gold)' },
          { label: 'Callback', val: agent.callback, color: 'var(--blue)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { label: 'Interested', val: agent.interested, color: 'var(--primary)' },
          { label: 'Demo Booked', val: agent.demosBooked, color: 'var(--purple)' },
          { label: 'Closed', val: agent.closed, color: 'var(--gold)' },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>
              <span>{label}</span><span>{pct(val, total)}%</span>
            </div>
            <div style={{ height: 3, background: 'var(--bg4)', borderRadius: 2 }}>
              <div style={{ width: `${pct(val, total)}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineBar({ label, count, max, color }) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 90, fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ width: 30, fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text)', textAlign: 'right', flexShrink: 0 }}>{count}</div>
    </div>
  );
}

function outcomeColor(outcome) {
  const map = {
    'Demo Booked': 'var(--purple)',
    'Interested':  'var(--primary)',
    'Closed':      'var(--gold)',
    'Callback':    'var(--blue)',
    'Called':      'var(--text2)',
    'No Answer':   'var(--text3)',
    'Voicemail':   'var(--text3)',
    'Not Qualified': 'var(--red)',
  };
  return map[outcome] || 'var(--text2)';
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)  return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function ConversionChart({ data }) {
  if (!data) {
    return (
      <div className="panel" style={{ flex: 1 }}>
        <div className="panel-head">
          <div className="panel-title">7-Day Conversions</div>
        </div>
        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
          Loading…
        </div>
      </div>
    );
  }

  const { days, conversionRate, totalDemos } = data;
  const maxCount = Math.max(...days.map(d => d.count), 1);
  const CHART_H = 120;

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="panel-head">
        <div className="panel-title">7-Day Conversions</div>
        <span style={{ fontSize: 11, color: 'var(--primary)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
          {conversionRate}% avg rate
        </span>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: CHART_H, marginBottom: 6 }}>
        {days.map(({ day, count }) => {
          const barH = Math.max(4, Math.round((count / maxCount) * CHART_H));
          return (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              {count > 0 && (
                <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                  {count}
                </div>
              )}
              <div style={{
                width: '100%',
                height: barH,
                background: count > 0
                  ? 'linear-gradient(to top, var(--primary), rgba(0,229,160,0.25))'
                  : 'var(--bg4)',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.5s ease',
                flexShrink: 0,
              }} />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {days.map(({ day }) => (
          <div key={day} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text3)' }}>
            {day}
          </div>
        ))}
      </div>

      <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
        Avg conversion rate:{' '}
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{conversionRate}%</span>
        {' · '}{totalDemos} demo{totalDemos !== 1 ? 's' : ''} total
      </div>
    </div>
  );
}

function PhoneStatusPanel({ health, recordingsCount }) {
  const connected = health?.connected === true;
  const numbers   = health?.numbers || [];
  const dbg       = health?.debug;

  if (!connected) {
    return (
      <div className="panel" style={{ width: 280, flexShrink: 0 }}>
        <div className="panel-head">
          <div className="panel-title">Phone Status</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0 8px', gap: 6 }}>
          <Radio size={20} color="var(--text3)" />
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 }}>
            {dbg?.reason || 'Phone system not connected'}
          </div>
        </div>
        {/* Debug block — shows raw API error so admin can diagnose without tailing logs */}
        {dbg && (dbg.error || dbg.rawBody) && (
          <div style={{
            margin: '8px 0 4px', padding: '8px 10px',
            background: 'var(--bg3)', borderRadius: 6,
            fontSize: 10, color: 'var(--text3)',
            fontFamily: "'DM Mono', monospace", lineHeight: 1.6,
            wordBreak: 'break-all', overflowWrap: 'break-word',
          }}>
            {dbg.statusCode && <div style={{ color: 'var(--orange)', marginBottom: 2 }}>HTTP {dbg.statusCode}</div>}
            {dbg.error && <div>{dbg.error}</div>}
            {dbg.rawBody && (
              <div style={{ marginTop: 4, color: 'var(--text3)', opacity: 0.8 }}>
                {dbg.rawBody.length > 200 ? dbg.rawBody.slice(0, 200) + '…' : dbg.rawBody}
              </div>
            )}
            <div style={{ marginTop: 4, color: 'var(--text3)', opacity: 0.6 }}>
              key={dbg.keyPresent ? '✓' : '✗'} secret={dbg.secretPresent ? '✓' : '✗'}
            </div>
          </div>
        )}
      </div>
    );
  }

  const activeNumbers = numbers.filter(n => n.status === 'active').length;
  const flaggedNumbers = numbers.filter(n => n.status === 'spam-flagged' || n.status === 'suspended');

  return (
    <div className="panel" style={{ width: 280, flexShrink: 0 }}>
      <div className="panel-head">
        <div className="panel-title">Phone Status</div>
        <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>connected</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Active Numbers', val: activeNumbers, color: 'var(--primary)' },
          { label: 'Minutes Today',  val: '—',            color: 'var(--text2)' },
          { label: 'Flagged',        val: flaggedNumbers.length, color: flaggedNumbers.length > 0 ? 'var(--orange)' : 'var(--text2)' },
          { label: 'Recordings',     val: recordingsCount ?? '—', color: 'var(--blue)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {flaggedNumbers.length > 0 && (
        <div style={{
          background: 'var(--orange-dim)', borderRadius: 6, padding: '8px 10px',
          fontSize: 11, color: 'var(--orange)', lineHeight: 1.5,
        }}>
          ⚠ {flaggedNumbers.length} number{flaggedNumbers.length !== 1 ? 's' : ''} flagged
          <div style={{ fontSize: 10, color: 'var(--orange)', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
            {flaggedNumbers.map(n => n.number || n.friendlyName).join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [teamStats, setTeamStats]         = useState(null);
  const [agentStats, setAgentStats]       = useState([]);
  const [feed, setFeed]                   = useState([]);
  const [conversionData, setConversionData] = useState(null);
  const [jcHealth, setJcHealth]           = useState(null);
  const [recordingsCount, setRecordingsCount] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [lastRefresh, setLastRefresh]     = useState(null);

  const { liveEvents, connected } = useRealtimeFeed();

  useEffect(() => {
    if (liveEvents.length === 0) return;
    setFeed(prev => {
      const merged = [...liveEvents, ...prev];
      const seen = new Set();
      return merged.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }).slice(0, 50);
    });
  }, [liveEvents]);

  const loadAll = useCallback(async () => {
    try {
      const [teamR, agentsR, feedR, convR, jcHealthR, jcRecR] = await Promise.allSettled([
        api.get('/stats/team'),
        api.get('/stats/agents'),
        api.get('/feed?limit=30'),
        api.get('/stats/conversion'),
        api.get('/justcall/health'),
        api.get('/justcall/recordings'),
      ]);

      if (teamR.status === 'fulfilled')   setTeamStats(teamR.value.data.stats);
      if (agentsR.status === 'fulfilled') setAgentStats(agentsR.value.data.agents || []);

      if (feedR.status === 'fulfilled') {
        setFeed(prev => {
          const polled = feedR.value.data.feed || [];
          const merged = [...prev, ...polled];
          const seen = new Set();
          return merged.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }).slice(0, 50);
        });
      }

      if (convR.status === 'fulfilled')   setConversionData(convR.value.data);

      if (jcHealthR.status === 'fulfilled') {
        console.debug('[Dashboard] phone-health response:', jcHealthR.value.data);
        setJcHealth(jcHealthR.value.data);
      } else {
        // rejected = HTTP error (e.g. 401 from our server — token missing/expired)
        console.error('[Dashboard] phone-health error:', jcHealthR.reason?.message);
        setJcHealth({ numbers: [], connected: false });
      }

      if (jcRecR.status === 'fulfilled') {
        setRecordingsCount(jcRecR.value.data.recordings?.length ?? 0);
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard load error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 10000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const pipelineItems = teamStats ? [
    { label: 'New',          count: teamStats.new,          color: 'var(--text3)' },
    { label: 'Called',       count: teamStats.called,       color: 'var(--blue)' },
    { label: 'No Answer',    count: teamStats.noAnswer,     color: 'var(--text2)' },
    { label: 'Voicemail',    count: teamStats.voicemail,    color: 'var(--text2)' },
    { label: 'Callback',     count: teamStats.callback,     color: 'var(--gold)' },
    { label: 'Interested',   count: teamStats.interested,   color: 'var(--primary)' },
    { label: 'Demo Booked',  count: teamStats.demosBooked,  color: 'var(--purple)' },
    { label: 'Closed',       count: teamStats.closed,       color: 'var(--gold)' },
    { label: 'Not Qualified',count: teamStats.notQualified, color: 'var(--red)' },
  ] : [];

  const pipelineMax = pipelineItems.length ? Math.max(...pipelineItems.map(i => i.count), 1) : 1;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', paddingTop: 40 }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--text3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading dashboard…
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Dashboard</h1>
          <p className="page-subtitle">
            {lastRefresh && `Last updated ${timeAgo(lastRefresh.toISOString())} · `}
            {connected ? 'live feed connected' : 'polling every 10s'}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadAll}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* KPI Strip */}
      {teamStats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <KpiCard label="Total Leads" value={teamStats.totalLeads} sub="in pipeline" color="primary" icon={Users} />
          <KpiCard label="Interested" value={teamStats.interested} sub="warm leads" color="primary" icon={TrendingUp} />
          <KpiCard label="Demo Booked" value={teamStats.demosBooked} sub="scheduled" color="purple" icon={Calendar} />
          <KpiCard label="Closed" value={teamStats.closed} sub="won deals" color="gold" icon={Zap} />
          <KpiCard
            label="Pipeline Value"
            value={`$${(teamStats.pipelineValue || 0).toLocaleString()}`}
            sub="est. revenue"
            color="gold"
            icon={DollarSign}
          />
        </div>
      )}

      {/* Agent Leaderboard */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14 }}>Agent Leaderboard</div>
          {agentStats.some(a => a.isActive) && (
            <span style={{ fontSize: 10, color: 'var(--primary)', background: 'var(--primary-dim)', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
              {agentStats.filter(a => a.isActive).length} on call
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {agentStats.length === 0 ? (
            <div className="panel" style={{ width: '100%', color: 'var(--text3)', textAlign: 'center', padding: 24 }}>No agent data yet</div>
          ) : (
            agentStats.map(agent => <AgentCard key={agent.id} agent={agent} />)
          )}
        </div>
      </div>

      {/* Conversion Chart + Phone Status row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>
        <ConversionChart data={conversionData} />
        <PhoneStatusPanel health={jcHealth} recordingsCount={recordingsCount} />
      </div>

      {/* Bottom row: Pipeline + Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Pipeline Bars */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Pipeline Status</div>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
              {teamStats?.totalLeads || 0} total
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pipelineItems.map(item => (
              <PipelineBar key={item.label} {...item} max={pipelineMax} />
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="panel" style={{ maxHeight: 480, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-head" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="panel-title">Activity Feed</div>
              <Activity size={12} color="var(--text3)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {connected ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.2s ease-in-out infinite', display: 'inline-block' }} />
                  LIVE
                </span>
              ) : (
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>connecting…</span>
              )}
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {feed.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px 0', fontSize: 13 }}>
                No activity yet — outcomes will appear here in real time.
              </div>
            ) : (
              feed.map(entry => (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    background: outcomeColor(entry.outcome),
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600 }}>{entry.agentName}</span>
                      {' → '}
                      <span style={{ color: outcomeColor(entry.outcome), fontWeight: 600 }}>{entry.outcome}</span>
                      {' on '}
                      <span style={{ color: 'var(--text)' }}>{entry.business}</span>
                    </div>
                    {entry.note && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontStyle: 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        "{entry.note.length > 80 ? entry.note.slice(0, 80) + '…' : entry.note}"
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
                    {timeAgo(entry.timestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
