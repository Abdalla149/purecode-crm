import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import ghl from '../services/ghl.js';

const router = Router();
router.use(requireAuth);

// POST /api/calls/log — receives call-ended event from SDK, appends duration note to GHL
router.post('/log', async (req, res) => {
  try {
    const { leadId, duration } = req.body;
    if (!leadId) return res.status(400).json({ error: 'leadId required' });

    const mins = Math.floor((duration || 0) / 60);
    const secs = (duration || 0) % 60;
    const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    await ghl.addNote(leadId, {
      text:      `Call duration: ${durationStr}`,
      agentName: req.user.name,
      outcome:   'Called',
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[CALLS LOG ERROR]', err);
    res.status(500).json({ error: 'Could not log call' });
  }
});

export default router;
