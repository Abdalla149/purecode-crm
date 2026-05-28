import fs     from 'fs';
import path   from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const DATA_DIR    = path.join(__dirname, '../data');
const EVENTS_FILE = path.join(DATA_DIR, 'activity_events.json');
const MAX_EVENTS  = 500;

function read() {
  try { return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8')); }
  catch { return []; }
}

function write(events) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

/**
 * Append a new event to the persistent log (capped at 500, newest first).
 * Safe to call fire-and-forget — never throws.
 */
export function logEvent({ agent, type, leadName = null, leadPhone = null, detail = null }) {
  const event = {
    id:        crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    agent:     agent || 'Unknown',
    type,
    leadName:  leadName  || null,
    leadPhone: leadPhone || null,
    detail:    detail    || null,
  };
  try {
    const events = read();
    events.unshift(event);
    if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
    write(events);
  } catch (err) {
    console.error('[ACTIVITY] Write failed:', err.message);
  }
  return event;
}

/**
 * Read events for the dashboard endpoint.
 * If `since` is given, returns only events strictly newer than that ISO timestamp.
 * Otherwise returns the most recent `limit` events (default 50).
 */
export function getEvents({ since = null, limit = 50 } = {}) {
  const events = read();
  if (since) {
    const t = new Date(since).getTime();
    if (!isNaN(t)) return events.filter(e => new Date(e.timestamp).getTime() > t);
  }
  return events.slice(0, limit);
}
