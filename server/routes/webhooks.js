import { Router } from 'express';
import crypto from 'crypto';
import ghl from '../services/ghl.js';
import { logActivity, setAgentInactive } from './feed.js';
import { logEvent } from '../services/activity.js';

const router = Router();

// ─── Signature verification ─────────────────────────────────────────────────
// Optional: set JUSTCALL_WEBHOOK_SECRET in .env to enable HMAC verification.
// JustCall signs the raw body with SHA-256 and sends it in x-justcall-signature.
function verifySignature(req) {
  const secret = process.env.JUSTCALL_WEBHOOK_SECRET;
  if (!secret) return true; // not configured — skip (dev only)

  const sig = req.headers['x-justcall-signature'];
  if (!sig) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// ─── Payload normaliser ─────────────────────────────────────────────────────
// JustCall sends slightly different shapes depending on plan / API version.
// This normalises them all into one clean object.
function parseJustCallPayload(body) {
  // v2 format: { type, data: { ... } }
  const d = body.data || body;

  return {
    callId:       d.call_sid  || d.call_id   || d.id    || null,
    direction:    d.direction                            || 'outbound',
    toNumber:     d.to        || d.contact_number        || '',
    fromNumber:   d.from      || d.agent_number          || '',
    duration:     parseInt(d.duration)                  || 0,
    rawStatus:    d.status    || d.call_status           || '',
    recordingUrl: d.recording_url || d.recordingUrl      || null,
    agentId:      String(d.agent_id  || d.agentId || ''),
    agentName:    d.agent_name || d.agentName            || 'Agent',
    notes:        d.notes     || d.note                  || '',
    contactName:  d.contact_name || d.contactName        || '',
  };
}

// Map JustCall call status → CRM outcome
function statusToOutcome(rawStatus, duration) {
  const s = (rawStatus || '').toLowerCase();
  if (s === 'completed' || s === 'answered') {
    return duration > 0 ? 'Called' : 'No Answer';
  }
  if (s === 'no-answer' || s === 'no_answer' || s === 'noanswer') return 'No Answer';
  if (s === 'busy')    return 'No Answer';
  if (s === 'failed')  return 'No Answer';
  if (s === 'voicemail') return 'Voicemail';
  return 'Called';
}

function formatDuration(secs) {
  if (!secs) return '0s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── POST /api/webhooks/justcall ────────────────────────────────────────────
router.post('/justcall', async (req, res) => {
  // Acknowledge immediately — JustCall expects a fast 200
  res.json({ received: true });

  if (!verifySignature(req)) {
    console.warn('[WEBHOOK] Signature mismatch — ignoring');
    return;
  }

  const body = req.body;

  // Only process call-end events
  const eventType = body.type || body.event_type || '';
  const isCallEnd = !eventType || // no type field = legacy format, always a call event
    eventType.includes('call_completed') ||
    eventType.includes('call_ended') ||
    eventType.includes('call');

  if (!isCallEnd) {
    console.log('[WEBHOOK] Non-call event ignored:', eventType);
    return;
  }

  const call = parseJustCallPayload(body);
  const outcome = statusToOutcome(call.rawStatus, call.duration);

  console.log(`[WEBHOOK] Call ended — agent: ${call.agentName}, to: ${call.toNumber}, status: ${call.rawStatus}, duration: ${call.duration}s`);

  // Find the GHL contact by phone number
  let contact = null;
  let contactName = call.contactName;

  if (call.toNumber) {
    try {
      const leads = await ghl.getLeads({ search: call.toNumber, limit: 10 });
      // Match by phone — normalize to digits only for comparison
      const digits = (n) => n.replace(/\D/g, '');
      contact = leads.find(l => digits(l.phone) === digits(call.toNumber));
      if (contact) contactName = contact.companyName || contact.name || contactName;
    } catch (err) {
      console.error('[WEBHOOK] Contact lookup failed:', err.message);
    }
  }

  // Build note body
  const noteLines = [
    `Duration: ${formatDuration(call.duration)}`,
    call.notes ? `Notes: ${call.notes}` : null,
    call.recordingUrl ? `Recording: ${call.recordingUrl}` : null,
  ].filter(Boolean);

  // Update GHL contact if we found one
  if (contact) {
    try {
      await ghl.addNote(contact.id, {
        text: noteLines.join(' | '),
        agentName: call.agentName,
        outcome,
      });
      // Only update status if the call was substantive (answered + has duration)
      if (call.duration > 5) {
        await ghl.updateLead(contact.id, { status: outcome });
      }
    } catch (err) {
      console.error('[WEBHOOK] GHL update failed:', err.message);
    }

    // Clear active-call indicator for this agent
    // We don't have the ghlUserId here — use agentName match as best-effort
    // (proper clearing happens when agent files outcome from the UI)
  }

  // Log to activity feed + broadcast via SSE
  logActivity({
    agentName: call.agentName,
    agentId:   call.agentId || null,
    business:  contactName || call.toNumber,
    outcome,
    note: noteLines.join(' | '),
  });

  logEvent({
    agent:     call.agentName,
    type:      'call_ended',
    leadName:  contactName || null,
    leadPhone: call.toNumber || null,
    detail:    call.duration ? formatDuration(call.duration) : null,
  });
});

// ─── POST /api/webhooks/test — dev-only simulation ─────────────────────────
// Simulates a call-end event so you can test the full pipeline without
// a real JustCall call. Protected — never enable in production.
router.post('/test', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const {
    agentName  = 'Test Agent',
    toNumber   = '+17145550101',
    outcome    = 'Demo Booked',
    duration   = 180,
    business   = 'Horizon Roofing',
  } = req.body;

  logActivity({ agentName, agentId: null, business, outcome, note: `Duration: ${formatDuration(duration)}` });
  res.json({ ok: true, message: `Simulated ${outcome} for ${business}` });
});

export default router;
