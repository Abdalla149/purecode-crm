import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getEvents } from '../services/activity.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/dashboard/activity?since={ISO timestamp}&limit={n}
// Returns events newer than `since`, or the most recent `limit` (default 50).
// Newest first. Used by the admin dashboard on a 5-second polling cycle.
router.get('/activity', (req, res) => {
  const since  = req.query.since  || null;
  const limit  = req.query.limit  ? Math.min(parseInt(req.query.limit), 200) : 50;
  const events = getEvents({ since, limit });
  res.json({ events, count: events.length });
});

export default router;
