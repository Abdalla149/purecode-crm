import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import ghl from '../services/ghl.js';
import { getActiveAgents } from './feed.js';

const router = Router();
router.use(requireAuth);

// Known agents with their GHL user IDs (mirrors auth.js USERS)
const AGENT_LIST = [
  { id: 'agent_khalid', name: 'Khalid', ghlUserId: 'mwhEdKvuwIUFFujKry9y' },
  { id: 'agent_omar',   name: 'Omar',   ghlUserId: '3zHvVi4Kee0XV8Y8A4aI' },
  { id: 'agent_sara',   name: 'Sara',   ghlUserId: '9OcAH0DjAFvzWChwnxKq' },
];

function computeStats(leads) {
  return {
    totalLeads:   leads.length,
    new:          leads.filter(l => l.status === 'New').length,
    called:       leads.filter(l => l.status === 'Called').length,
    noAnswer:     leads.filter(l => l.status === 'No Answer').length,
    voicemail:    leads.filter(l => l.status === 'Voicemail').length,
    callback:     leads.filter(l => l.status === 'Callback').length,
    interested:   leads.filter(l => l.status === 'Interested').length,
    demosBooked:  leads.filter(l => l.status === 'Demo Booked').length,
    closed:       leads.filter(l => l.status === 'Closed').length,
    notQualified: leads.filter(l => l.status === 'Not Qualified').length,
  };
}

// GET /api/stats/me — agent's own stats
router.get('/me', async (req, res) => {
  try {
    // Use ghlUserId so the filter matches GHL's assignedTo field
    const agentGhlId = req.user.ghlUserId;
    if (!agentGhlId) {
      return res.json({ stats: computeStats([]) });
    }
    const leads = await ghl.getLeads({ assignedAgent: agentGhlId, limit: 100 });
    res.json({ stats: computeStats(leads) });
  } catch (err) {
    console.error('[STATS/ME]', err.message);
    res.status(500).json({ error: 'Could not load stats' });
  }
});

// GET /api/stats/team — admin only, aggregate across all leads
router.get('/team', requireAdmin, async (req, res) => {
  try {
    const leads = await ghl.getLeads({ limit: 100 });
    const stats = computeStats(leads);
    // Pipeline value estimate: Interested × $500 + Demo Booked × $2,500 + Closed × $4,500
    stats.pipelineValue =
      stats.interested  * 500  +
      stats.demosBooked * 2500 +
      stats.closed      * 4500;
    res.json({ stats });
  } catch (err) {
    console.error('[STATS/TEAM]', err.message);
    res.status(500).json({ error: 'Could not load team stats' });
  }
});

// GET /api/stats/agents — admin only, per-agent breakdown + active-call status
router.get('/agents', requireAdmin, async (req, res) => {
  try {
    const allLeads   = await ghl.getLeads({ limit: 100 });
    const activeCalls = getActiveAgents();

    const agentStats = AGENT_LIST.map(agent => {
      const agentLeads = allLeads.filter(l => l.assignedAgent === agent.ghlUserId);
      return {
        ...agent,
        isActive: activeCalls.has(agent.ghlUserId),
        ...computeStats(agentLeads),
      };
    });

    res.json({ agents: agentStats });
  } catch (err) {
    console.error('[STATS/AGENTS]', err.message);
    res.status(500).json({ error: 'Could not load agent stats' });
  }
});

// GET /api/stats/agent/me — agent's own detailed KPI stats
// Must be defined BEFORE /agent/:agentId so "me" isn't caught as a param
router.get('/agent/me', async (req, res) => {
  try {
    const agentGhlId = req.user.ghlUserId;
    if (!agentGhlId) {
      return res.json({ stats: { callsToday: 0, interested: 0, demosBooked: 0, talkTime: 0 } });
    }
    const leads = await ghl.getLeads({ assignedAgent: agentGhlId, limit: 100 });
    const s = computeStats(leads);
    res.json({
      stats: {
        // callsToday = all leads with any outcome (proxy for total contacted)
        callsToday:  s.called + s.noAnswer + s.voicemail + s.callback +
                     s.interested + s.demosBooked + s.closed + s.notQualified,
        interested:  s.interested,
        demosBooked: s.demosBooked,
        talkTime:    0, // populated once calling service is connected
      },
    });
  } catch (err) {
    console.error('[STATS/AGENT/ME]', err.message);
    res.status(500).json({ error: 'Could not load stats' });
  }
});

// GET /api/stats/agent/:agentId — admin only, single agent by GHL user ID
router.get('/agent/:agentId', requireAdmin, async (req, res) => {
  try {
    const leads = await ghl.getLeads({ assignedAgent: req.params.agentId, limit: 100 });
    res.json({ stats: computeStats(leads) });
  } catch (err) {
    res.status(500).json({ error: 'Could not load agent stats' });
  }
});

// GET /api/stats/conversion — 7-day demo booking trend (admin only)
router.get('/conversion', requireAdmin, async (req, res) => {
  try {
    const leads = await ghl.getLeads({ limit: 100 });
    const demoLeads = leads.filter(l => l.status === 'Demo Booked');

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const count = demoLeads.filter(l => l.dateAdded && l.dateAdded.startsWith(dateStr)).length;
      days.push({ day: label, date: dateStr, count });
    }

    const totalLeads = leads.length || 1;
    const totalDemos = demoLeads.length;
    const conversionRate = parseFloat(((totalDemos / totalLeads) * 100).toFixed(1));

    res.json({ days, conversionRate, totalDemos });
  } catch (err) {
    console.error('[STATS/CONVERSION]', err.message);
    res.status(500).json({ error: 'Could not load conversion data' });
  }
});

export default router;
