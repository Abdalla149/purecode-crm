import { Router } from 'express';
import ghl from '../services/ghl.js';
import { logActivity } from './feed.js';

const router = Router();

// POST /api/webhooks/justcall
// JustCall fires this when a call ends
// Updates GHL contact with call data + recording URL
router.post('/justcall', async (req, res) => {
  try {
    const payload = req.body;

    // TODO: Verify webhook signature for security
    // const signature = req.headers['x-justcall-signature'];

    console.log('[WEBHOOK] JustCall call ended:', payload.call_id);

    // Extract call data from JustCall webhook payload
    const callData = {
      callId: payload.call_id || payload.id,
      toNumber: payload.to || payload.contact_number,
      fromNumber: payload.from || payload.agent_number,
      duration: payload.duration || 0,
      status: payload.status || payload.call_status, // answered, no-answer, busy
      recordingUrl: payload.recording_url || null,
      agentName: payload.agent_name || 'Unknown',
      timestamp: payload.datetime || new Date().toISOString(),
    };

    // Log activity for the feed
    logActivity({
      agentName: callData.agentName,
      agentId: null,
      business: callData.toNumber, // Will be enriched with business name
      outcome: callData.status === 'answered' ? 'Called' : 'No Answer',
      note: `Duration: ${callData.duration}s`,
    });

    // TODO: Match toNumber to a GHL contact and update:
    // - Add note with call details
    // - Attach recording URL
    // - Update last activity timestamp

    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
