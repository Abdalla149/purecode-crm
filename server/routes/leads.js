// ═══════════════════════════════════════════════════════
// LEADS ROUTES — Pipeline Management
// ═══════════════════════════════════════════════════════
// All lead operations. Server-side filtered by role:
//   - Admin: sees everything, can reassign
//   - Agent: sees only their assigned leads
// ═══════════════════════════════════════════════════════

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import ghl from '../services/ghl.js';
import justcall from '../services/justcall.js';
import { logActivity, setAgentActive, setAgentInactive } from './feed.js';
import { logEvent } from '../services/activity.js';

function outcomeToEventType(outcome) {
  const map = {
    'Interested':    'interested',
    'Demo Booked':   'demo_booked',
    'Callback':      'callback',
    'Not Qualified': 'not_qualified',
    'No Answer':     'no_answer',
    'Voicemail':     'voicemail',
    'Closed':        'closed',
    'Closed/Paid':   'closed',
  };
  return map[outcome] || 'call_ended';
}

const router = Router();

// All routes require authentication
router.use(requireAuth);


// ═══════════ GET /api/leads ═══════════
// Query params: ?status=New&tier=1&type=Roofing&search=horizon
router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      tier: req.query.tier,
      type: req.query.type,
      search: req.query.search,
    };

    // RBAC: agents only see their own leads — filter by GHL user ID
    if (req.user.role === 'agent') {
      filters.assignedAgent = req.user.ghlUserId;
    } else if (req.query.assigned) {
      // Admin can filter by agent
      filters.assignedAgent = req.query.assigned === 'unassigned' ? '' : req.query.assigned;
    }

    const leads = await ghl.getLeads(filters);
    console.log(`[QUEUE] ${req.user.name} (${req.user.role}) → ${leads.length} leads${filters.assignedAgent ? ` assigned to ${filters.assignedAgent}` : ''}`);
    res.json({ leads, total: leads.length });
  } catch (err) {
    console.error('[LEADS GET ERROR]', err);
    res.status(500).json({ error: 'Could not load leads' });
  }
});


// ═══════════ GET /api/leads/:id ═══════════
router.get('/:id', async (req, res) => {
  try {
    const lead = await ghl.getLead(req.params.id);

    // RBAC: agent can only view their own leads
    if (req.user.role === 'agent' && lead.assignedAgent !== req.user.ghlUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Also get notes
    const notes = await ghl.getNotes(req.params.id);
    res.json({ lead, notes });
  } catch (err) {
    console.error('[LEAD DETAIL ERROR]', err);
    res.status(500).json({ error: 'Could not load lead details' });
  }
});


// ═══════════ POST /api/leads/:id/note ═══════════
// Log a call outcome + note
router.post('/:id/note', async (req, res) => {
  try {
    const { text, outcome } = req.body;
    const lead = await ghl.getLead(req.params.id);

    // RBAC: agent can only add notes to their own leads
    if (req.user.role === 'agent' && lead.assignedAgent !== req.user.ghlUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await ghl.addNote(req.params.id, {
      text: text || '',
      agentName: req.user.name,
      outcome,
    });

    if (outcome) {
      await ghl.updateLead(req.params.id, { status: outcome });
      logActivity({
        agentName:  req.user.name,
        agentId:    req.user.ghlUserId,
        business:   lead.companyName || lead.name,
        outcome,
        note:       text || '',
      });
      logEvent({
        agent:     req.user.name,
        type:      outcomeToEventType(outcome),
        leadName:  lead.companyName || lead.name,
        leadPhone: lead.phone || null,
        detail:    text || null,
      });
      setAgentInactive(req.user.ghlUserId);
    }

    res.json({ success: true, message: 'Note saved' });
  } catch (err) {
    console.error('[NOTE ERROR]', err);
    res.status(500).json({ error: 'Could not save note' });
  }
});


// ═══════════ POST /api/leads/:id/call ═══════════
// Trigger click-to-call via JustCall
router.post('/:id/call', async (req, res) => {
  try {
    const lead = await ghl.getLead(req.params.id);

    // RBAC: agent can only call their own leads
    if (req.user.role === 'agent' && lead.assignedAgent !== req.user.ghlUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!lead.phone) {
      return res.status(400).json({ error: 'Lead has no phone number' });
    }

    // Get agent's numbers and pick the rotated one
    // TODO: Get numbers from user record or req.user
    const agentNumbers = req.body.agentNumbers || [];
    const activeNumber = justcall.pickRotatedNumber(agentNumbers);

    // Mark agent as on a call (cleared when they file an outcome)
    setAgentActive(req.user.ghlUserId);

    logEvent({
      agent:     req.user.name,
      type:      'call_started',
      leadName:  lead.companyName || lead.name,
      leadPhone: lead.phone,
    });

    const result = await justcall.makeCall({
      fromNumber: activeNumber.number,
      toNumber: lead.phone,
      agentJustcallId: req.user.agentId,
    });

    // Increment counter for rotation
    justcall.incrementCallCount(activeNumber.id);

    res.json({
      success: true,
      callId: result.callId,
      usedNumber: activeNumber.number,
      callsOnThisNumber: justcall.getCallCounts([activeNumber])[0].callsToday,
    });
  } catch (err) {
    console.error('[CALL ERROR]', err);
    res.status(500).json({ error: 'Could not place call — try again' });
  }
});


// ═══════════ POST /api/leads/:id/welcome-email ═══════════
// Mark that the agent sent a welcome email — moves lead to Interested + tags it
router.post('/:id/welcome-email', async (req, res) => {
  try {
    const lead = await ghl.getLead(req.params.id);

    if (req.user.role === 'agent' && lead.assignedAgent !== req.user.ghlUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dateTag = `welcome-email-sent-${today}`;

    await Promise.all([
      ghl.updateLead(req.params.id, { status: 'Interested' }),
      ghl.addTags(req.params.id, ['welcome-email-sent', dateTag]),
      ghl.addNote(req.params.id, {
        text: `Welcome email sent on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        agentName: req.user.name,
        outcome: 'Interested',
      }),
    ]);

    logEvent({
      agent:     req.user.name,
      type:      'email_sent',
      leadName:  lead.companyName || lead.name,
      leadPhone: lead.phone || null,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[WELCOME EMAIL ERROR]', err);
    res.status(500).json({ error: 'Something went wrong — contact David' });
  }
});


// ═══════════ PUT /api/leads/:id/assign ═══════════
// Admin only — reassign a lead to a different agent
router.put('/:id/assign', requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.body;
    
    await ghl.updateLead(req.params.id, { assignedAgent: agentId || '' });
    res.json({ success: true, message: 'Lead reassigned' });
  } catch (err) {
    console.error('[ASSIGN ERROR]', err);
    res.status(500).json({ error: 'Could not reassign lead' });
  }
});


// ═══════════ POST /api/leads/bulk-assign ═══════════
// Admin only — bulk assign unassigned leads
router.post('/bulk-assign', requireAdmin, async (req, res) => {
  try {
    const { agentId, type, tier, count = 25 } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID required' });
    }

    const result = await ghl.bulkAssign({
      agentId,
      filters: { type, tier },
      count,
    });

    res.json({
      success: true,
      message: `Assigned ${result.assigned} leads`,
      assigned: result.assigned,
    });
  } catch (err) {
    console.error('[BULK ASSIGN ERROR]', err);
    res.status(500).json({ error: 'Bulk assign failed' });
  }
});


// ═══════════ POST /api/leads/bulk-unassign-agent ═══════════
// Admin only — remove all leads from one agent
router.post('/bulk-unassign-agent', requireAdmin, async (req, res) => {
  try {
    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId required' });

    const leads = await ghl.getLeads({ assignedAgent: agentId });
    console.log(`[UNASSIGN] Unassigning ${leads.length} leads from ${agentId}`);

    let unassigned = 0;
    const BATCH = 20;
    for (let i = 0; i < leads.length; i += BATCH) {
      if (i > 0) await new Promise(r => setTimeout(r, 200));
      const results = await Promise.allSettled(
        leads.slice(i, i + BATCH).map(l => ghl.updateLead(l.id, { assignedAgent: '' }))
      );
      unassigned += results.filter(r => r.status === 'fulfilled').length;
    }

    ghl.clearContactCache();
    res.json({ success: true, unassigned, total: leads.length });
  } catch (err) {
    console.error('[UNASSIGN AGENT ERROR]', err);
    res.status(500).json({ error: 'Could not unassign leads — contact David' });
  }
});


// ═══════════ POST /api/leads/bulk-reassign-agent ═══════════
// Admin only — move all leads from one agent to another
router.post('/bulk-reassign-agent', requireAdmin, async (req, res) => {
  try {
    const { fromAgentId, toAgentId } = req.body;
    if (!fromAgentId) return res.status(400).json({ error: 'fromAgentId required' });

    const leads = await ghl.getLeads({ assignedAgent: fromAgentId });
    console.log(`[REASSIGN] Moving ${leads.length} leads from ${fromAgentId} → ${toAgentId || 'unassigned'}`);

    let reassigned = 0;
    const BATCH = 20;
    for (let i = 0; i < leads.length; i += BATCH) {
      if (i > 0) await new Promise(r => setTimeout(r, 200));
      const results = await Promise.allSettled(
        leads.slice(i, i + BATCH).map(l => ghl.updateLead(l.id, { assignedAgent: toAgentId || '' }))
      );
      reassigned += results.filter(r => r.status === 'fulfilled').length;
    }

    ghl.clearContactCache();
    res.json({ success: true, reassigned, total: leads.length });
  } catch (err) {
    console.error('[REASSIGN AGENT ERROR]', err);
    res.status(500).json({ error: 'Could not reassign leads — contact David' });
  }
});


// ═══════════ POST /api/leads/reset-all-agents ═══════════
// Admin only — strip all agent assignments from the entire pipeline
router.post('/reset-all-agents', requireAdmin, async (req, res) => {
  try {
    const all      = await ghl.getLeads();
    const assigned = all.filter(l => l.assignedAgent);
    console.log(`[RESET] Unassigning all ${assigned.length} assigned leads`);

    let unassigned = 0;
    const BATCH = 20;
    for (let i = 0; i < assigned.length; i += BATCH) {
      if (i > 0) await new Promise(r => setTimeout(r, 200));
      const results = await Promise.allSettled(
        assigned.slice(i, i + BATCH).map(l => ghl.updateLead(l.id, { assignedAgent: '' }))
      );
      unassigned += results.filter(r => r.status === 'fulfilled').length;
    }

    ghl.clearContactCache();
    res.json({ success: true, unassigned, total: assigned.length });
  } catch (err) {
    console.error('[RESET ALL ERROR]', err);
    res.status(500).json({ error: 'Could not reset agents — contact David' });
  }
});


export default router;
