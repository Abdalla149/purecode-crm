// ═══════════════════════════════════════════════════════
// GHL SERVICE — The GHL Wrapper
// ═══════════════════════════════════════════════════════
// Every GHL API call goes through this file. This is the
// ONLY place in the codebase that knows GHL exists.
// If you ever switch from GHL to another CRM, you only
// change this one file. Everything else stays the same.
//
// GHL REST API v1 docs: https://highlevel.stoplight.io/
// ═══════════════════════════════════════════════════════

const GHL_BASE = process.env.GHL_BASE_URL || 'https://rest.gohighlevel.com/v1';
const GHL_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

async function ghlRequest(endpoint, options = {}) {
  const url = `${GHL_BASE}${endpoint}`;
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GHL_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[GHL ERROR] ${options.method || 'GET'} ${endpoint} → ${res.status}`, errBody);
    throw new Error(`CRM request failed (${res.status})`); // Generic — never say "GHL"
  }

  return res.json();
}


// ═══════════ CONTACTS / LEADS ═══════════

/**
 * Get all contacts (leads), optionally filtered
 * GHL returns paginated results — this handles it
 */
export async function getLeads({ assignedAgent, status, tier, type, search, limit = 100 } = {}) {
  let endpoint = `/contacts/?locationId=${LOCATION_ID}&limit=${limit}`;
  
  if (search) {
    endpoint += `&query=${encodeURIComponent(search)}`;
  }

  const data = await ghlRequest(endpoint);
  let contacts = data.contacts || [];

  // Map GHL contact fields → our clean lead format
  let leads = contacts.map(mapContactToLead);

  // Apply filters that GHL API doesn't support natively
  if (assignedAgent) {
    leads = leads.filter(l => l.assignedAgent === assignedAgent);
  }
  if (status) {
    leads = leads.filter(l => l.status === status);
  }
  if (tier) {
    leads = leads.filter(l => String(l.tier) === String(tier));
  }
  if (type) {
    leads = leads.filter(l => l.businessType === type);
  }

  return leads;
}

/**
 * Get a single lead by ID
 */
export async function getLead(contactId) {
  const data = await ghlRequest(`/contacts/${contactId}`);
  return mapContactToLead(data.contact);
}

/**
 * Update a lead's status, assigned agent, or other fields
 */
export async function updateLead(contactId, updates) {
  // Map our clean field names back to GHL custom field IDs
  const ghlBody = {};
  
  if (updates.status) {
    ghlBody.tags = updates.status; // or use custom field
  }
  if (updates.assignedAgent !== undefined) {
    ghlBody.assignedTo = updates.assignedAgent;
  }
  // Add custom fields mapping as needed
  if (updates.customFields) {
    ghlBody.customField = updates.customFields;
  }

  return ghlRequest(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify(ghlBody)
  });
}

/**
 * Add a note to a contact
 */
export async function addNote(contactId, { text, agentName, outcome }) {
  const noteBody = `[${outcome || 'Note'}] by ${agentName}: ${text}`;
  
  return ghlRequest(`/contacts/${contactId}/notes`, {
    method: 'POST',
    body: JSON.stringify({
      body: noteBody
    })
  });
}

/**
 * Get notes for a contact
 */
export async function getNotes(contactId) {
  const data = await ghlRequest(`/contacts/${contactId}/notes`);
  return (data.notes || []).map(n => ({
    id: n.id,
    text: n.body,
    createdAt: n.dateAdded,
  }));
}

/**
 * Bulk assign leads to an agent
 */
export async function bulkAssign({ agentId, filters = {}, count = 25 }) {
  // Get unassigned leads matching filters
  const leads = await getLeads({
    assignedAgent: '', // unassigned
    type: filters.type,
    tier: filters.tier,
    limit: count
  });

  const toAssign = leads.filter(l => !l.assignedAgent).slice(0, count);
  
  // Update each one
  const results = await Promise.allSettled(
    toAssign.map(lead => 
      updateLead(lead.id, { assignedAgent: agentId })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  return { assigned: succeeded, total: toAssign.length };
}


// ═══════════ FIELD MAPPING ═══════════
// This is where GHL's field names get translated to YOUR field names.
// Update these mappings after you create custom fields in GHL.

function mapContactToLead(contact) {
  // TODO: Update these custom field keys after creating them in GHL
  // Go to GHL → Settings → Custom Fields → copy the field key
  const customFields = {};
  if (contact.customField) {
    contact.customField.forEach(f => {
      customFields[f.id] = f.value;
    });
  }

  return {
    id: contact.id,
    name: contact.firstName 
      ? `${contact.firstName} ${contact.lastName || ''}`.trim()
      : contact.companyName || 'Unknown',
    companyName: contact.companyName || '',
    phone: contact.phone || '',
    email: contact.email || '',
    city: contact.city || '',
    state: contact.state || '',
    
    // These come from custom fields you'll create in GHL:
    // TODO: Replace 'FIELD_ID_xxx' with actual GHL custom field IDs
    businessType: customFields['FIELD_ID_business_type'] || '',
    tier: customFields['FIELD_ID_tier'] || 2,
    ownerName: customFields['FIELD_ID_owner_name'] || '',
    googleScore: customFields['FIELD_ID_google_score'] || '',
    hookNote: customFields['FIELD_ID_hook_note'] || '',
    
    // Standard GHL fields
    status: contact.tags?.[0] || 'New', // Using first tag as status
    assignedAgent: contact.assignedTo || '',
    lastActivity: contact.lastActivity || null,
    dateAdded: contact.dateAdded || null,
    
    // Warnings (from a custom field)
    warning: customFields['FIELD_ID_warning'] || '',
  };
}


// ═══════════ STATS HELPERS ═══════════

/**
 * Get stats for an agent or the whole team
 */
export async function getAgentStats(agentId = null) {
  const leads = await getLeads(agentId ? { assignedAgent: agentId } : {});
  
  return {
    totalLeads: leads.length,
    new: leads.filter(l => l.status === 'New').length,
    called: leads.filter(l => l.status === 'Called').length,
    noAnswer: leads.filter(l => l.status === 'No Answer').length,
    interested: leads.filter(l => l.status === 'Interested').length,
    demosBooked: leads.filter(l => l.status === 'Demo Booked').length,
    closed: leads.filter(l => l.status === 'Closed').length,
    notQualified: leads.filter(l => l.status === 'Not Qualified').length,
  };
}

export default {
  getLeads,
  getLead,
  updateLead,
  addNote,
  getNotes,
  bulkAssign,
  getAgentStats,
};
