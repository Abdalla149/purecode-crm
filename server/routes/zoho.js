import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import { saveTokenEntry, getTokenEntry, readTokens, writeTokens } from '../services/zoho.js';
import jwt from 'jsonwebtoken';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_DIR   = path.join(__dirname, '../data');
const SESSIONS_FILE = path.join(DATA_DIR, 'zoho_sessions.json');

const REGION        = process.env.ZOHO_REGION        || 'com';
const CLIENT_ID     = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REDIRECT_URI  = process.env.ZOHO_REDIRECT_URI  || 'https://purecode-crm.onrender.com/api/zoho/callback';
const FRONTEND_URL  = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
const AUTH_URL      = `https://accounts.zoho.${REGION}/oauth/v2/auth`;
const TOKEN_URL     = `https://accounts.zoho.${REGION}/oauth/v2/token`;
const SCOPES        = 'ZohoMail.messages.ALL,ZohoMail.accounts.READ,ZohoMail.folders.READ';

// ── Session helpers ───────────────────────────────────────
function readSessions() {
  try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch { return {}; }
}
function writeSessions(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

// ── Auth helper that also accepts ?token= (for browser redirects) ──
function resolveUser(req) {
  // Standard header-based JWT
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      return jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    } catch { /* fall through */ }
  }
  // Query-param JWT (full-page redirect, no way to send header)
  const qToken = req.query.token;
  if (qToken) {
    try {
      return jwt.verify(qToken, process.env.JWT_SECRET);
    } catch { /* fall through */ }
  }
  return null;
}

// ── GET /api/zoho/connect ─────────────────────────────────
// Initiates the OAuth flow. Accepts JWT via ?token= since this
// is a full-page browser navigation (no Authorization header).
router.get('/connect', (req, res) => {
  const user = resolveUser(req);
  if (!user) return res.status(401).send('Unauthorized');

  const state = crypto.randomUUID();
  const sessions = readSessions();
  sessions[state] = { agentId: user.id, agentKey: user.name.toLowerCase(), createdAt: new Date().toISOString() };
  writeSessions(sessions);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         SCOPES,
    access_type:   'offline',
    state,
  });

  res.redirect(`${AUTH_URL}?${params}`);
});

// ── GET /api/zoho/callback ────────────────────────────────
// Zoho redirects here after user authorisation.
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[ZOHO] OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}/settings?zoho=error`);
  }

  // Validate state
  const sessions = readSessions();
  const session  = sessions[state];
  if (!session) {
    return res.redirect(`${FRONTEND_URL}/settings?zoho=error`);
  }

  // Expire sessions older than 10 min
  const age = Date.now() - new Date(session.createdAt).getTime();
  if (age > 10 * 60 * 1000) {
    delete sessions[state];
    writeSessions(sessions);
    return res.redirect(`${FRONTEND_URL}/settings?zoho=expired`);
  }

  // Exchange code for tokens
  const params = new URLSearchParams({
    code,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri:  REDIRECT_URI,
    grant_type:    'authorization_code',
  });

  let body;
  try {
    const tokenRes = await fetch(TOKEN_URL, { method: 'POST', body: params });
    body = await tokenRes.json();
    if (!tokenRes.ok || body.error) throw new Error(body.error || tokenRes.status);
  } catch (err) {
    console.error('[ZOHO] Token exchange failed:', err.message);
    delete sessions[state];
    writeSessions(sessions);
    return res.redirect(`${FRONTEND_URL}/settings?zoho=error`);
  }

  // Fetch account ID + email from Zoho Mail API
  let accountId = null;
  let email     = null;
  try {
    const acctRes = await fetch(`https://mail.zoho.${REGION}/api/accounts`, {
      headers: { Authorization: `Zoho-oauthtoken ${body.access_token}` },
    });
    const acctBody = await acctRes.json();
    const primary  = acctBody?.data?.[0];
    accountId = primary?.accountId ?? null;
    email     = primary?.emailAddress?.[0]?.mailAddress ?? null;
  } catch (err) {
    console.error('[ZOHO] Could not fetch account info:', err.message);
  }

  const expiresAt = new Date(Date.now() + (body.expires_in || 3600) * 1000).toISOString();
  saveTokenEntry(session.agentKey, {
    accountId,
    email,
    accessToken:  body.access_token,
    refreshToken: body.refresh_token,
    expiresAt,
    connectedAt:  new Date().toISOString(),
  });

  delete sessions[state];
  writeSessions(sessions);

  console.log(`[ZOHO] Connected for agent: ${session.agentKey} (${email})`);
  res.redirect(`${FRONTEND_URL}/settings?zoho=connected`);
});

// ── GET /api/zoho/status ──────────────────────────────────
router.get('/status', requireAuth, (req, res) => {
  const agentKey = req.user.name.toLowerCase();
  const entry    = getTokenEntry(agentKey);
  if (!entry?.accessToken) return res.json({ connected: false });
  res.json({
    connected:   true,
    email:       entry.email   || null,
    connectedAt: entry.connectedAt || null,
  });
});

// ── POST /api/zoho/disconnect ─────────────────────────────
router.post('/disconnect', requireAuth, (req, res) => {
  const agentKey = req.user.name.toLowerCase();
  const all = readTokens();
  delete all[agentKey];
  writeTokens(all);
  console.log(`[ZOHO] Disconnected agent: ${agentKey}`);
  res.json({ success: true });
});

export default router;
