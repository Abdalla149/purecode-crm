import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import justcall from '../services/justcall.js';

const router = Router();
router.use(requireAuth);

// GET /api/justcall/health — admin only
router.get('/health', requireAdmin, async (req, res) => {
  try {
    const numbers = await justcall.getNumberHealth();
    res.json({ numbers });
  } catch (err) {
    res.status(500).json({ error: 'Could not check phone number status' });
  }
});

// GET /api/justcall/calls — recent call logs
router.get('/calls', async (req, res) => {
  try {
    const filters = {
      limit: parseInt(req.query.limit) || 50,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    // Agents only see their own calls
    if (req.user.role === 'agent') {
      filters.agentId = req.user.agentId;
    } else if (req.query.agentId) {
      filters.agentId = req.query.agentId;
    }

    const calls = await justcall.getCallLogs(filters);
    res.json({ calls });
  } catch (err) {
    res.status(500).json({ error: 'Could not load call history' });
  }
});

// GET /api/justcall/my-numbers — agent's phone numbers with rotation status
router.get('/my-numbers', async (req, res) => {
  try {
    // Numbers are stored in the user record (from auth)
    // This endpoint returns them with current call counts
    const agentNumbers = req.body.agentNumbers || []; // TODO: Get from user DB
    const withCounts = justcall.getCallCounts(agentNumbers);
    res.json({ numbers: withCounts });
  } catch (err) {
    res.status(500).json({ error: 'Could not load phone numbers' });
  }
});

export default router;
