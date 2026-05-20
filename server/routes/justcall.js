import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import justcall from '../services/justcall.js';
import ghl from '../services/ghl.js';

const router = Router();
router.use(requireAuth);

// GET /api/justcall/health — admin only
router.get('/health', requireAdmin, async (req, res) => {
  const keyPresent    = !!process.env.JUSTCALL_API_KEY;
  const secretPresent = !!process.env.JUSTCALL_API_SECRET;

  if (!keyPresent) {
    return res.json({
      numbers: [], connected: false,
      debug: { reason: 'JUSTCALL_API_KEY env var not set', keyPresent, secretPresent },
    });
  }

  try {
    const numbers = await justcall.getNumberHealth();
    res.json({ numbers, connected: true, debug: { keyPresent, secretPresent, count: numbers.length } });
  } catch (err) {
    console.error('[JUSTCALL/HEALTH]', err.message);
    res.json({
      numbers: [], connected: false,
      debug: {
        error:      err.message,
        statusCode: err.statusCode || null,
        rawBody:    err.rawBody    || null,
        keyPresent,
        secretPresent,
      },
    });
  }
});

// GET /api/justcall/recordings — admin only, call recordings cross-referenced with leads
router.get('/recordings', requireAdmin, async (req, res) => {
  if (!process.env.JUSTCALL_API_KEY) {
    return res.json({ recordings: [], connected: false });
  }
  try {
    const calls = await justcall.getCallLogs({ limit: 100 });
    const withRecordings = calls.filter(c => c.recordingUrl);

    // Enrich with business name from GHL contacts
    const leads = await ghl.getLeads({ limit: 100 }).catch(() => []);
    const phoneMap = {};
    leads.forEach(l => {
      const digits = (l.phone || '').replace(/\D/g, '');
      if (digits) phoneMap[digits] = l;
    });

    const enriched = withRecordings.map(call => {
      const digits = (call.to || '').replace(/\D/g, '');
      const lead = phoneMap[digits] || null;
      return { ...call, business: lead?.name || '—' };
    });

    res.json({ recordings: enriched, connected: true });
  } catch (err) {
    console.error('[JUSTCALL/RECORDINGS]', err.message);
    res.json({ recordings: [], connected: false });
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
