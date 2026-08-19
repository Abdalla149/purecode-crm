// ═══════════════════════════════════════════════════════
// JUSTCALL SERVICE — The Calling Layer
// ═══════════════════════════════════════════════════════
// Handles all JustCall API calls. Agents never see
// "JustCall" — they just see a green call button.
//
// JustCall API docs: https://developer.justcall.io/
// ═══════════════════════════════════════════════════════

async function jcRequest(endpoint, options = {}) {
  // JustCall v2 API — Basic auth with base64(api_key:api_secret)
  const base   = process.env.JUSTCALL_BASE_URL || 'https://api.justcall.io/v2';
  const key    = process.env.JUSTCALL_API_KEY;
  const secret = process.env.JUSTCALL_API_SECRET;
  const url    = `${base}${endpoint}`;
  const authHeader = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': authHeader,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      ...options.headers,
    },
  });

  const rawText = await res.text();
  // Always log so Render logs show exactly what the API returned
  console.log(`[JUSTCALL] ${options.method || 'GET'} ${endpoint} → ${res.status} | ${rawText.slice(0, 600)}`);

  if (!res.ok) {
    const err = new Error(`Calling service error (${res.status})`);
    err.statusCode = res.status;
    err.rawBody    = rawText;
    throw err;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`Non-JSON response: ${rawText.slice(0, 200)}`);
  }
}


// ═══════════ CLICK TO CALL ═══════════

/**
 * Trigger a call from agent's number to the lead's number
 * @param {string} fromNumber - Agent's JustCall number (auto-rotated)
 * @param {string} toNumber - Lead's phone number
 * @param {string} agentJustcallId - Agent's JustCall user ID
 */
export async function makeCall({ fromNumber, toNumber, agentJustcallId }) {
  const data = await jcRequest('/calls/make', {
    method: 'POST',
    body: JSON.stringify({
      from: fromNumber,
      to: toNumber,
      agent_id: agentJustcallId,
    })
  });

  return {
    callId: data.id || data.call_id,
    status: data.status,
  };
}


// ═══════════ CALL LOGS ═══════════

/**
 * Get call logs (JustCall v2), optionally filtered by agent + date range.
 * Pages through /v2/calls and filters in-code (v2 returns newest-first).
 * Dates are YYYY-MM-DD (inclusive). Returns normalized rows with durations
 * in seconds — the source of truth for hours/performance reports.
 */
export async function getCallLogs({ agentId, startDate, endDate, limit = 1000 } = {}) {
  const start = startDate ? new Date(`${startDate}T00:00:00Z`).getTime() : null;
  const end   = endDate   ? new Date(`${endDate}T23:59:59Z`).getTime()   : null;
  const out = [];

  for (let page = 0; page < 60; page++) {
    const data = await jcRequest(`/calls?page=${page}&per_page=100`);
    const rows = data.data || [];
    for (const c of rows) {
      if (agentId && String(c.agent_id) !== String(agentId)) continue;
      const ts = new Date(`${c.call_date}T${c.call_time || '00:00:00'}Z`).getTime();
      if (start && ts < start) continue;
      if (end && ts > end) continue;
      const dur = c.call_duration || {};
      out.push({
        id:               c.id,
        contactNumber:    c.contact_number,
        justcallNumber:   c.justcall_number,
        line:             c.justcall_line_name,
        agentId:          c.agent_id,
        agentName:        c.agent_name,
        direction:        c.call_info?.direction || null,
        type:             c.call_info?.type || null,       // call, voicemail, missed, etc
        totalSecs:        dur.total_duration ?? 0,          // full call length
        conversationSecs: dur.conversation_time ?? 0,       // actual talk time
        handleSecs:       dur.handle_time ?? 0,
        timestamp:        ts,
        date:             c.call_date,
        recordingUrl:     c.call_info?.recording || null,
      });
      if (out.length >= limit) return out;
    }
    if (!data.next_page_link) break;
  }
  return out;
}


// ═══════════ NUMBER HEALTH ═══════════

/**
 * Get all phone numbers and their status
 * Admin-only — shows spam flags, usage, etc
 */
export async function getNumberHealth() {
  const data = await jcRequest('/lines');
  
  return (data.data || []).map(num => ({
    id: num.id,
    number: num.phone_number,
    friendlyName: num.friendly_name || num.phone_number,
    assignedTo: num.agent_id || null,
    status: num.status || 'active', // active, suspended, spam-flagged
    capabilities: num.capabilities || {},
  }));
}


// ═══════════ AGENT NUMBER ROTATION ═══════════

// In-memory call counter per number per day
// Resets daily. In production, persist this in Supabase.
const dailyCallCounts = {};

function getCountKey(numberId) {
  const today = new Date().toISOString().split('T')[0];
  return `${today}:${numberId}`;
}

/**
 * Pick the next number for an agent based on rotation rules
 * Each number gets 30 calls, then rotates to the next
 * @param {Array} agentNumbers - Array of {id, number} for this agent
 * @returns {object} - The number to use
 */
export function pickRotatedNumber(agentNumbers) {
  const CALLS_PER_NUMBER = 30;

  for (const num of agentNumbers) {
    const key = getCountKey(num.id);
    const count = dailyCallCounts[key] || 0;
    if (count < CALLS_PER_NUMBER) {
      return num;
    }
  }

  // All numbers exhausted — wrap to first
  return agentNumbers[0];
}

/**
 * Increment call count for a number
 */
export function incrementCallCount(numberId) {
  const key = getCountKey(numberId);
  dailyCallCounts[key] = (dailyCallCounts[key] || 0) + 1;
  return dailyCallCounts[key];
}

/**
 * Get current call counts for an agent's numbers
 */
export function getCallCounts(agentNumbers) {
  return agentNumbers.map(num => ({
    ...num,
    callsToday: dailyCallCounts[getCountKey(num.id)] || 0,
    maxCalls: 30,
  }));
}


export default {
  makeCall,
  getCallLogs,
  getNumberHealth,
  pickRotatedNumber,
  incrementCallCount,
  getCallCounts,
};
