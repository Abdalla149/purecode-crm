// ═══════════════════════════════════════════════════════
// IMPORT ROUTE — Background CSV import with live polling
// ═══════════════════════════════════════════════════════
// POST /api/import        → queue a job, return { jobId, total } immediately
// GET  /api/import/status/:jobId → return live job progress
// ═══════════════════════════════════════════════════════

import { randomUUID }              from 'node:crypto';
import { Router }                  from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import ghl                         from '../services/ghl.js';

const router = Router();
router.use(requireAuth);   // sets req.user from JWT — must come before requireAdmin
router.use(requireAdmin);  // verifies req.user.role === 'admin'

// ── In-memory job store (cleared on server restart, jobs auto-expire after 2h) ──
const jobs = new Map();

setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (new Date(job.startedAt).getTime() < cutoff) jobs.delete(id);
  }
}, 30 * 60 * 1000);


// ── Process a single lead, update job counters in-place ──
async function processOneLead(jobId, lead, assignment) {
  const job = jobs.get(jobId);

  try {
    await ghl.createContact(lead, assignment);
    job.imported++;
    console.log(`[IMPORT ${jobId}] [${job.processed}/${job.total}] NEW: ${lead.name} ${lead.phone}`);
  } catch (createErr) {
    const isDuplicate = /duplicat|already.exist/i.test(createErr.message);

    if (!isDuplicate) {
      job.skipped++;
      job.errors.push({ name: lead.name, phone: lead.phone, error: createErr.message });
      console.error(`[IMPORT ${jobId}] [${job.processed}/${job.total}] FAILED: ${lead.name} ${lead.phone} | ${createErr.message}`);
      return;
    }

    // ── Duplicate path: find existing contact then update it ──
    console.log(`[IMPORT ${jobId}] [${job.processed}/${job.total}] DUPLICATE detected for ${lead.name} ${lead.phone} — looking up existing contact`);

    // First check if GHL returned the existing contact ID in the error response body
    let existingId = createErr.ghlParsed?.contact?.id || null;
    if (existingId) {
      console.log(`[IMPORT ${jobId}] Existing contact id found in error body: ${existingId}`);
    } else {
      const existing = await ghl.findDuplicateContact(lead.phone);
      existingId = existing?.id || null;
    }

    if (!existingId) {
      job.skipped++;
      job.errors.push({ name: lead.name, phone: lead.phone, error: 'Duplicate — existing contact not found in CRM' });
      console.warn(`[IMPORT ${jobId}] Duplicate but no ID for ${lead.name} ${lead.phone}`);
      return;
    }

    try {
      await ghl.updateExistingContact(existingId, lead, assignment);
      job.updated++;
      console.log(`[IMPORT ${jobId}] [${job.processed}/${job.total}] UPDATED: ${lead.name} → id:${existingId}`);
    } catch (updateErr) {
      job.skipped++;
      job.errors.push({ name: lead.name, phone: lead.phone, error: `Update failed: ${updateErr.message}` });
      console.error(`[IMPORT ${jobId}] Update failed for ${lead.name} id:${existingId} | ${updateErr.message}`);
    }
  }
}


// ── Background job processor ──
async function processImportJob(jobId, leads, assignment) {
  const job = jobs.get(jobId);
  job.status = 'processing';

  try {
    for (let i = 0; i < leads.length; i++) {
      // 150ms between each lead → ~6-7 leads/sec, well under GHL's 100/10s rate limit
      if (i > 0) await new Promise(r => setTimeout(r, 150));

      const lead = leads[i];
      job.processed = i + 1;

      if (!lead.phone) {
        job.skipped++;
        console.log(`[IMPORT ${jobId}] [${i + 1}/${leads.length}] Skipped (no phone): ${lead.name || 'unnamed'}`);
        continue;
      }

      try {
        await processOneLead(jobId, lead, assignment);
      } catch (err) {
        // Last-resort catch — processOneLead handles its own errors, but protect the loop
        job.skipped++;
        job.errors.push({ name: lead.name || '?', phone: lead.phone || '', error: err.message });
        console.error(`[IMPORT ${jobId}] Uncaught at lead ${i + 1}:`, err.message);
      }
    }

    job.status      = 'complete';
    job.completedAt = new Date().toISOString();
    console.log(`[IMPORT ${jobId}] ✓ Complete — imported:${job.imported} updated:${job.updated} skipped:${job.skipped} errors:${job.errors.length}`);
  } catch (err) {
    job.status     = 'failed';
    job.fatalError = err.message;
    console.error(`[IMPORT ${jobId}] Fatal error:`, err.message);
  }
}


// ─────────────────────────────────────────────────────
// POST /api/import — queue a background import job
// Returns immediately with jobId so the frontend can poll
// ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { leads = [], assignment = {} } = req.body;

  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'No leads provided' });
  }

  const jobId = randomUUID();
  jobs.set(jobId, {
    id:          jobId,
    total:       leads.length,
    processed:   0,
    imported:    0,
    updated:     0,
    skipped:     0,
    errors:      [],
    status:      'queued',
    startedAt:   new Date().toISOString(),
    completedAt: null,
    assignment,
  });

  console.log(`[IMPORT ${jobId}] Queued — ${leads.length} leads, agent:${assignment.agentId || 'unassigned'}, type:${assignment.businessType || '?'}`);

  // Fire-and-forget — response returns before processing finishes
  processImportJob(jobId, leads, assignment).catch(err => {
    console.error(`[IMPORT ${jobId}] Unhandled rejection:`, err);
    const job = jobs.get(jobId);
    if (job) { job.status = 'failed'; job.fatalError = err.message; }
  });

  res.json({ jobId, status: 'queued', total: leads.length });
});


// ─────────────────────────────────────────────────────
// GET /api/import/status/:jobId — live progress
// ─────────────────────────────────────────────────────
router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});


export default router;
