import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import ghl from '../services/ghl.js';

const router = Router();
router.use(requireAuth);

// GET /api/stats/me — agent's own stats
router.get('/me', async (req, res) => {
  try {
    const stats = await ghl.getAgentStats(req.user.id);
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Could not load stats' });
  }
});

// GET /api/stats/team — admin only, all agents
router.get('/team', requireAdmin, async (req, res) => {
  try {
    const teamStats = await ghl.getAgentStats(); // no filter = all
    res.json({ stats: teamStats });
  } catch (err) {
    res.status(500).json({ error: 'Could not load team stats' });
  }
});

// GET /api/stats/agent/:agentId — admin only
router.get('/agent/:agentId', requireAdmin, async (req, res) => {
  try {
    const stats = await ghl.getAgentStats(req.params.agentId);
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Could not load agent stats' });
  }
});

export default router;
