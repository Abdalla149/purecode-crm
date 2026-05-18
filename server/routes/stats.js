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

// GET /api/stats/agent/:agentId — admin only, single agent by GHL user ID
router.get('/agent/:agentId', requireAdmin, async (req, res) => {
  try {
    const leads = await ghl.getLeads({ assignedAgent: req.params.agentId, limit: 100 });
    res.json({ stats: computeStats(leads) });
  } catch (err) {
    res.status(500).json({ error: 'Could not load agent stats' });
  }
});

export default router;
