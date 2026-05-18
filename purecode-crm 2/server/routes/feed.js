import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// In-memory activity log (move to Supabase for persistence)
// Each entry: { id, agentName, agentId, business, outcome, note, timestamp }
const activityLog = [];

// Add an activity entry (called internally by leads routes and webhooks)
export function logActivity({ agentName, agentId, business, outcome, note }) {
  activityLog.unshift({
    id: `act_${Date.now()}`,
    agentName,
    agentId,
    business,
    outcome,
    note: note || '',
    timestamp: new Date().toISOString(),
  });
  // Keep last 500 entries
  if (activityLog.length > 500) activityLog.pop();
}

// GET /api/feed — activity feed
// Agents see WINS only (Demo Booked, Closed)
// Admin sees everything
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  let feed = activityLog;

  if (req.user.role === 'agent') {
    // Agents only see wins — creates momentum without demoralizing noise
    feed = feed.filter(a => 
      ['Demo Booked', 'Closed', 'Interested'].includes(a.outcome)
    );
  }

  res.json({ feed: feed.slice(0, limit) });
});

export default router;
