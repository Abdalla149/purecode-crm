import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ─── In-memory state ───────────────────────────────────────────────────────
const activityLog  = [];
const activeAgents = new Set();       // ghlUserIds currently on an active call
const sseClients   = new Map();       // clientId → { res, role }
let   nextClientId = 1;

// ─── Agent active tracking ─────────────────────────────────────────────────
export function setAgentActive(ghlUserId)   { activeAgents.add(ghlUserId); }
export function setAgentInactive(ghlUserId) { activeAgents.delete(ghlUserId); }
export function getActiveAgents()           { return new Set(activeAgents); }

// ─── SSE helpers ───────────────────────────────────────────────────────────
function sseWrite(res, eventType, data) {
  res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Broadcast a new activity event to all connected SSE clients.
// Agents only receive wins — same rule as GET /feed.
function broadcastEvent(entry) {
  const isWin = ['Demo Booked', 'Closed', 'Interested'].includes(entry.outcome);
  sseClients.forEach(({ res, role }) => {
    if (role === 'agent' && !isWin) return;
    sseWrite(res, 'activity', entry);
  });
}

// ─── Activity log ──────────────────────────────────────────────────────────
export function logActivity({ agentName, agentId, business, outcome, note }) {
  const entry = {
    id:        `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    agentName,
    agentId,
    business,
    outcome,
    note:      note || '',
    timestamp: new Date().toISOString(),
  };
  activityLog.unshift(entry);
  if (activityLog.length > 500) activityLog.pop();
  broadcastEvent(entry);
}

// ─── GET /api/feed — initial load / polling fallback ──────────────────────
router.get('/', requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  let feed = activityLog;
  if (req.user.role === 'agent') {
    feed = feed.filter(a => ['Demo Booked', 'Closed', 'Interested'].includes(a.outcome));
  }
  res.json({ feed: feed.slice(0, limit) });
});

// ─── GET /api/feed/stream — Server-Sent Events ────────────────────────────
// EventSource doesn't support custom headers, so auth token is passed
// as ?token= query param. Verified server-side before opening the stream.
router.get('/stream', (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION';
  const token = req.query.token;
  if (!token) return res.status(401).end();

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).end();
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders();

  const clientId = nextClientId++;
  sseClients.set(clientId, { res, role: user.role });

  // Send initial connection confirmation
  sseWrite(res, 'connected', { clientId, role: user.role });

  // Heartbeat every 25s to prevent proxy/browser timeout
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
  });
});

export default router;
