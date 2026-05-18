// ═══════════════════════════════════════════════════════
// JUSTCALL SERVICE — The Calling Layer
// ═══════════════════════════════════════════════════════
// Handles all JustCall API calls. Agents never see
// "JustCall" — they just see a green call button.
//
// JustCall API docs: https://developer.justcall.io/
// ═══════════════════════════════════════════════════════

const JC_BASE = process.env.JUSTCALL_BASE_URL || 'https://api.justcall.io/v1';
const JC_KEY = process.env.JUSTCALL_API_KEY;
const JC_SECRET = process.env.JUSTCALL_API_SECRET;

async function jcRequest(endpoint, options = {}) {
  const url = `${JC_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `${JC_KEY}:${JC_SECRET}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    }
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[JUSTCALL ERROR] ${options.method || 'GET'} ${endpoint} → ${res.status}`, errBody);
    throw new Error(`Calling service error (${res.status})`); // Generic — never say "JustCall"
  }

  return res.json();
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
 * Get recent call logs for an agent
 */
export async function getCallLogs({ agentId, startDate, endDate, limit = 50 }) {
  const params = new URLSearchParams({
    per_page: String(limit),
    ...(agentId && { agent_id: agentId }),
    ...(startDate && { start_date: startDate }),
    ...(endDate && { end_date: endDate }),
  });

  const data = await jcRequest(`/calls?${params}`);
  
  return (data.data || []).map(call => ({
    id: call.id,
    from: call.from_number,
    to: call.to_number,
    duration: call.duration,
    status: call.status,         // answered, no-answer, busy, etc
    recordingUrl: call.recording_url || null,
    agentId: call.agent_id,
    timestamp: call.created_at,
    direction: call.direction,
  }));
}


// ═══════════ NUMBER HEALTH ═══════════

/**
 * Get all phone numbers and their status
 * Admin-only — shows spam flags, usage, etc
 */
export async function getNumberHealth() {
  const data = await jcRequest('/phone-numbers');
  
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
