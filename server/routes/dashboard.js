import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getEvents } from '../services/activity.js';
import ghl from '../services/ghl.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// ── Agent roster — mirrors auth.js USERS and stats.js AGENT_LIST ─────────────
const AGENTS = [
  { name: 'Lucas', ghlUserId: '7c0sDQ3oEzttlQfa3jAA' },
  { name: 'Harry', ghlUserId: 'EFYhirIwNFKAY04HjbbK' },
  { name: 'Jim',   ghlUserId: 'CUqipGSIfqu2o7bcWroN' },
  { name: 'Bruce', ghlUserId: 'hHYQ1Yk7EZhxjjFYYGln' },
];

// ── 5-second response cache (shared across concurrent dashboard polls) ────────
let _liveCache   = null;
let _liveCacheTs = 0;
const LIVE_CACHE_TTL = 5_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Parse "2m 30s", "45s", "1m 0s" → seconds
function parseDurationSecs(detail) {
  if (!detail) return 0;
  let total = 0;
  const m = detail.match(/(\d+)m/);
  const s = detail.match(/(\d+)s/);
  if (m) total += parseInt(m[1], 10) * 60;
  if (s) total += parseInt(s[1], 10);
  return total;
}

function todayMidnightMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── GET /api/dashboard/live ───────────────────────────────────────────────────
router.get('/live', async (req, res) => {
  // Return cached response if fresh
  if (_liveCache && Date.now() - _liveCacheTs < LIVE_CACHE_TTL) {
    return res.json(_liveCache);
  }

  try {
    // Both calls in parallel — GHL already has its own 30s internal cache
    const [allLeads, events] = await Promise.all([
      ghl.getLeads(),
      getEvents({ limit: 500 }),
    ]);

    const nowMs         = Date.now();
    const midnightMs    = todayMidnightMs();
    const tenMinMs      = 10 * 60 * 1000;
    const thirtyMinMs   = 30 * 60 * 1000;

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const interested  = allLeads.filter(l => l.status === 'Interested').length;
    const demoBooked  = allLeads.filter(l => l.status === 'Demo Booked').length;
    const closed      = allLeads.filter(l => ['Closed', 'Closed/Paid'].includes(l.status)).length;

    const kpis = {
      totalLeads:    allLeads.length,
      interested,
      demoBooked,
      closed,
      pipelineValue: interested * 500 + demoBooked * 2500 + closed * 4500,
    };

    // ── Per-agent stats ───────────────────────────────────────────────────────
    const agents = AGENTS.map(agent => {
      const agentLeads = allLeads.filter(l => l.assignedAgent === agent.ghlUserId);

      // Normalise agent name for event matching (case-insensitive prefix match
      // handles full names like "Lucas Smith" stored in JustCall)
      const nameLC = agent.name.toLowerCase();
      const agentEvents = events.filter(
        e => e.agent && e.agent.toLowerCase().startsWith(nameLC)
      );

      // Today's events only
      const agentEventsToday = agentEvents.filter(
        e => new Date(e.timestamp).getTime() >= midnightMs
      );

      // ── Calls today: count call_started (one per CRM-initiated call) ────────
      const callsToday = agentEventsToday.filter(e => e.type === 'call_started').length;

      // ── Talk time: sum call_ended durations today ────────────────────────────
      const talkTimeSecs = agentEventsToday
        .filter(e => e.type === 'call_ended')
        .reduce((sum, e) => sum + parseDurationSecs(e.detail), 0);

      // ── Agent status ─────────────────────────────────────────────────────────
      // Events are newest-first, so [0] is the most recent.
      const lastStart = agentEvents.find(e => e.type === 'call_started');
      const lastEnd   = agentEvents.find(e => e.type === 'call_ended');

      let status      = 'away';
      let currentLead = null;

      if (lastStart) {
        const startMs = new Date(lastStart.timestamp).getTime();
        const endMs   = lastEnd ? new Date(lastEnd.timestamp).getTime() : 0;

        // on_call: most recent call_started is within 10 min AND came after last call_ended
        if (nowMs - startMs < tenMinMs && startMs > endMs) {
          status      = 'on_call';
          currentLead = lastStart.leadName || null;
        }
      }

      if (status !== 'on_call') {
        const lastEvent = agentEvents[0];
        const lastEventMs = lastEvent ? new Date(lastEvent.timestamp).getTime() : 0;
        status = lastEventMs && (nowMs - lastEventMs < thirtyMinMs) ? 'idle' : 'away';
      }

      // ── Pipeline counts from GHL leads ────────────────────────────────────
      const agentInterested = agentLeads.filter(l => l.status === 'Interested').length;
      const agentDemo       = agentLeads.filter(l => l.status === 'Demo Booked').length;
      const agentClosed     = agentLeads.filter(l => ['Closed', 'Closed/Paid'].includes(l.status)).length;
      const agentCallback   = agentLeads.filter(l => l.status === 'Callback').length;

      const conversionRate = callsToday > 0
        ? parseFloat(((agentInterested + agentDemo + agentClosed) / callsToday * 100).toFixed(1))
        : 0.0;

      return {
        name:            agent.name,
        status,
        currentLead,
        totalLeads:      agentLeads.length,
        callsToday,
        interested:      agentInterested,
        demoBooked:      agentDemo,
        closed:          agentClosed,
        callback:        agentCallback,
        talkTimeMinutes: parseFloat((talkTimeSecs / 60).toFixed(1)),
        conversionRate,
      };
    });

    const result = { kpis, agents, lastUpdated: new Date().toISOString() };
    _liveCache   = result;
    _liveCacheTs = Date.now();

    res.json(result);
  } catch (err) {
    console.error('[DASHBOARD/LIVE]', err.message);
    res.status(500).json({ error: 'Could not load dashboard' });
  }
});

// ── GET /api/dashboard/activity?since={ISO timestamp}&limit={n} ───────────────
// Returns events newer than `since`, or the most recent `limit` (default 50).
// Newest first. Used by the admin dashboard on a 5-second polling cycle.
router.get('/activity', (req, res) => {
  const since  = req.query.since || null;
  const limit  = req.query.limit ? Math.min(parseInt(req.query.limit, 10), 200) : 50;
  const events = getEvents({ since, limit });
  res.json({ events, count: events.length });
});

export default router;
