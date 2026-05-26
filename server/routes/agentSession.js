import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
router.use(requireAuth);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_DIR   = path.join(__dirname, '../data');
const SESSION_FILE = path.join(DATA_DIR, 'agent_sessions.json');

function readSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeSessions(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[SESSION] Write failed:', err.message);
  }
}

// GET /api/agent/session/position
router.get('/position', (req, res) => {
  const entry = readSessions()[req.user.id];
  res.json(entry
    ? { lastLeadId: entry.lastLeadId, lastUpdated: entry.lastUpdated }
    : { lastLeadId: null }
  );
});

// POST /api/agent/session/position
router.post('/position', (req, res) => {
  const { leadId } = req.body;
  if (!leadId) return res.status(400).json({ error: 'leadId required' });
  const sessions = readSessions();
  sessions[req.user.id] = { lastLeadId: leadId, lastUpdated: new Date().toISOString() };
  writeSessions(sessions);
  res.json({ success: true });
});

export default router;
