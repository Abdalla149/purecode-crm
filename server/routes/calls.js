import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Agent CRM ID → JustCall user ID + dedicated outbound number
const AGENT_MAP = {
  agent_lucas: { justcallId: 504027, fromNumber: '+18314803557' },
  agent_harry: { justcallId: 504026, fromNumber: '+18312312281' },
  agent_jim:   { justcallId: 504024, fromNumber: '+18313370742' },
  agent_bruce: { justcallId: 504021, fromNumber: '+18314014983' },
};

function toE164(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10)                           return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// POST /api/calls/dial
// Fires an outbound call through the calling service REST API.
// The agent receives the call on their desktop/mobile app.
router.post('/dial', async (req, res) => {
  try {
    const agentId   = req.user.id;            // always trust server-side identity
    const { leadPhone, leadName } = req.body;

    if (!leadPhone) {
      return res.status(400).json({ success: false, error: 'leadPhone required' });
    }

    const agent = AGENT_MAP[agentId];
    if (!agent) {
      return res.status(400).json({ success: false, error: 'Agent not configured for calling' });
    }

    const to = toE164(leadPhone);
    if (!to) {
      return res.status(400).json({ success: false, error: 'Invalid phone number' });
    }

    const API_KEY    = process.env.JUSTCALL_API_KEY;
    const API_SECRET = process.env.JUSTCALL_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      console.error('[DIAL] Missing API credentials');
      return res.status(500).json({ success: false, error: 'Calling service not configured' });
    }

    const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

    console.log(`[DIAL] ${req.user.name} → ${to} (${leadName || 'unknown'})`);

    const callRes = await fetch('https://api.justcall.io/v2.1/calls', {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        from:        agent.fromNumber,
        to,
        justcall_id: agent.justcallId,
      }),
    });

    let data = {};
    try { data = await callRes.json(); } catch {}

    if (!callRes.ok) {
      console.error(`[DIAL ERROR] ${callRes.status}`, JSON.stringify(data));
      return res.status(502).json({ success: false, error: 'Call service unavailable — try again' });
    }

    const callId = data?.data?.id ?? data?.id ?? null;
    console.log(`[DIAL] Call placed — id: ${callId}`);
    res.json({ success: true, callId });

  } catch (err) {
    console.error('[DIAL ERROR]', err.message);
    res.status(500).json({ success: false, error: 'Could not place call' });
  }
});

export default router;
