import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const JUSTCALL_BASE = 'https://api.justcall.io/v2.1';
const MAX_PAGES     = 10;
const CACHE_TTL     = 60_000; // 60 seconds

// ── Simple in-memory cache (unfiltered full fetch only) ───
let _cache   = null;
let _cacheTs = 0;

// ── Auth header ───────────────────────────────────────────
function buildAuth() {
  const key    = process.env.JUSTCALL_API_KEY;
  const secret = process.env.JUSTCALL_API_SECRET;
  if (!key || !secret) return null;
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

// ── Normalize one call record from v2.1 response ─────────
function normalize(c) {
  const ci = c.call_info || {};
  const dateTime = c.datetime
    ?? (c.call_date
      ? `${c.call_date}${c.call_time ? 'T' + c.call_time : ''}`
      : null);
  return {
    id:              c.id,
    contactNumber:   c.contact_number  || null,
    agentName:       c.agent_name      || null,
    justcallNumber:  c.justcall_number || null,
    status:          ci.status         || null,
    durationSeconds: ci.duration != null ? Number(ci.duration) : null,
    direction:       ci.direction      || ci.type || null,
    dateTime,
    recordingUrl:    c.recording       || c.recording_url || null,
  };
}

// ── Fetch all pages from JustCall v2.1 ───────────────────
async function fetchAllCalls({ from, to } = {}) {
  const auth = buildAuth();
  if (!auth) {
    throw Object.assign(new Error('API credentials not configured'), { code: 'NO_CREDS' });
  }

  const allCalls = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ per_page: '100', page: String(page) });
    if (from) params.set('from_datetime', from);
    if (to)   params.set('to_datetime',   to);

    const res = await fetch(`${JUSTCALL_BASE}/calls?${params}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });

    if (res.status === 401) {
      throw Object.assign(
        new Error('JustCall auth failed — check API credentials'),
        { code: 'UNAUTHORIZED' }
      );
    }
    if (res.status === 429) {
      throw Object.assign(
        new Error('Rate limit reached — try again in a moment'),
        { code: 'RATE_LIMITED' }
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const body = await res.json();

    // v2.1 returns { status, data: [...], total, per_page, current_page, last_page }
    const rows = Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.data?.data)
        ? body.data.data
        : [];

    allCalls.push(...rows);

    const lastPage = body.last_page ?? body.data?.last_page ?? null;
    if (lastPage !== null && page >= lastPage) break;

    const total = body.total ?? body.data?.total ?? null;
    if (total !== null && allCalls.length >= total) break;

    if (rows.length < 100) break; // partial page = final page
  }

  return allCalls;
}

// ── GET /api/recordings ───────────────────────────────────
router.get('/', async (req, res) => {
  const { agent, from, to, refresh } = req.query;
  const forceRefresh = refresh === 'true';

  // Cache only on unfiltered fetches; skip if caller requests a refresh
  const canUseCache = !from && !to && !forceRefresh;

  if (canUseCache && _cache && Date.now() - _cacheTs < CACHE_TTL) {
    const result = agent
      ? _cache.filter(r => r.agentName?.toLowerCase().includes(agent.toLowerCase()))
      : _cache;
    return res.json({ recordings: result, total: result.length, cached: true });
  }

  try {
    const raw = await fetchAllCalls({ from, to });

    const normalized = raw
      .map(normalize)
      .filter(r => r.recordingUrl)
      .sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));

    if (!from && !to) {
      _cache   = normalized;
      _cacheTs = Date.now();
    }

    const result = agent
      ? normalized.filter(r => r.agentName?.toLowerCase().includes(agent.toLowerCase()))
      : normalized;

    console.log(`[RECORDINGS] Fetched ${raw.length} calls → ${normalized.length} with recordings (${result.length} after filter)`);
    res.json({ recordings: result, total: result.length });
  } catch (err) {
    console.error('[RECORDINGS]', err.message);
    const status = err.code === 'UNAUTHORIZED' ? 401
                 : err.code === 'RATE_LIMITED'  ? 429
                 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
