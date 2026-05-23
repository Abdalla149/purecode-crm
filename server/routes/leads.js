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
      // Log to activity feed
      logActivity({
        agentName:  req.user.name,
        agentId:    req.user.ghlUserId,
        business:   lead.companyName || lead.name,
        outcome,
        note:       text || '',
      });
      // Clear active-call indicator once outcome is filed
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


export default router;
