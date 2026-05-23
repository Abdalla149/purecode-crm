// ═══════════════════════════════════════════════════════
// EMAIL ROUTES — Follow-up email logging
// ═══════════════════════════════════════════════════════

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import ghl from '../services/ghl.js';

const router = Router();
router.use(requireAuth);


// ═══════════ POST /api/emails/send-followup ═══════════
// Logs follow-up email content as a note on the contact + tags it.
// TODO Phase 3: Wire to Zoho Mail API for real send.
router.post('/send-followup', async (req, res) => {
  try {
    const { leadId, templateNumber, subject, body } = req.body;

    if (!leadId || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const lead = await ghl.getLead(leadId);

    if (req.user.role === 'agent' && lead.assignedAgent !== req.user.ghlUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const today = new Date().toISOString().split('T')[0];
    const tag   = `followup-${templateNumber || 1}-sent-${today}`;

    await Promise.all([
      ghl.addNote(leadId, {
        text: `[Follow-up email logged]\nSubject: ${subject || '(no subject)'}\n\n${body}`,
        agentName: req.user.name,
        outcome:   null,
      }),
      ghl.addTags(leadId, [tag]),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('[EMAIL SEND ERROR]', err);
    res.status(500).json({ error: 'Something went wrong — contact David' });
  }
});


export default router;
