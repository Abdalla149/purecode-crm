// ═══════════════════════════════════════════════════════
// ZOHO SERVICE — Token management + API helpers
// ═══════════════════════════════════════════════════════

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR    = path.join(__dirname, '../data');
const TOKENS_FILE = path.join(DATA_DIR, 'zoho_tokens.json');

const REGION       = process.env.ZOHO_REGION       || 'com';
const TOKEN_URL    = `https://accounts.zoho.${REGION}/oauth/v2/token`;
const CLIENT_ID    = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;

// ── File helpers ──────────────────────────────────────────
export function readTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function writeTokens(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
}

export function getTokenEntry(agentKey) {
  return readTokens()[agentKey] || null;
}

export function saveTokenEntry(agentKey, fields) {
  const all = readTokens();
  all[agentKey] = { ...all[agentKey], ...fields };
  writeTokens(all);
}

// ── getValidAccessToken ───────────────────────────────────
// Returns a fresh accessToken for agentKey (username, e.g. "lucas").
// Refreshes automatically if within 2 minutes of expiry.
export async function getValidAccessToken(agentKey) {
  const entry = getTokenEntry(agentKey);
  if (!entry?.accessToken) {
    throw Object.assign(new Error('Zoho not connected'), { code: 'NOT_CONNECTED' });
  }

  const expiresAt = new Date(entry.expiresAt).getTime();
  const twoMinMs  = 2 * 60 * 1000;

  if (Date.now() < expiresAt - twoMinMs) {
    return entry.accessToken; // still valid
  }

  // Need to refresh
  if (!entry.refreshToken) {
    throw Object.assign(new Error('No refresh token stored'), { code: 'TOKEN_EXPIRED' });
  }

  console.log(`[ZOHO] Refreshing token for ${agentKey}`);

  const params = new URLSearchParams({
    refresh_token:  entry.refreshToken,
    client_id:      CLIENT_ID,
    client_secret:  CLIENT_SECRET,
    grant_type:     'refresh_token',
  });

  const res  = await fetch(TOKEN_URL, { method: 'POST', body: params });
  const body = await res.json();

  if (!res.ok || body.error) {
    console.error(`[ZOHO] Refresh failed for ${agentKey}:`, body.error || res.status);
    throw Object.assign(new Error('Token refresh failed'), { code: 'TOKEN_EXPIRED' });
  }

  const newExpiry = new Date(Date.now() + (body.expires_in || 3600) * 1000).toISOString();
  saveTokenEntry(agentKey, {
    accessToken: body.access_token,
    expiresAt:   newExpiry,
  });

  console.log(`[ZOHO] Token refreshed for ${agentKey}, expires ${newExpiry}`);
  return body.access_token;
}
