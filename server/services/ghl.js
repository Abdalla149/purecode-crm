// ═══════════════════════════════════════════════════════
// GHL SERVICE — The GHL Wrapper
// ═══════════════════════════════════════════════════════
// Every GHL API call goes through this file. This is the
// ONLY place in the codebase that knows GHL exists.
// If you ever switch from GHL to another CRM, you only
// change this one file. Everything else stays the same.
//
// GHL REST API v2 docs: https://highlevel.stoplight.io/
// ═══════════════════════════════════════════════════════

async function ghlRequest(endpoint, options = {}) {
  const GHL_BASE    = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
  const GHL_KEY     = process.env.GHL_API_KEY;
  const url = `${GHL_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GHL_KEY}`,
      'Content-Type':  'application/json',
      'Version':       '2021-07-28',
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
  const LOCATION_ID = process.env.GHL_LOCATION_ID;
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
  const ghlBody = {};

  if (updates.status) {
    // Write outcome to the last_outcome custom field
    ghlBody.customFields = [{ id: '2XL9Hj5BS4M4UHgAkNNs', value: updates.status }];
  }
  if (updates.assignedAgent !== undefined) {
    ghlBody.assignedTo = updates.assignedAgent;
  }
  if (updates.customFields) {
    ghlBody.customFields = updates.customFields;
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
// GHL v2 returns custom fields by UUID only — no human-readable key.
// This map translates each UUID to the field name we use in the app.
// Run GET /locations/{id}/customFields if these ever need updating.
const CUSTOM_FIELD_IDS = {
  x8DJVqauQaM35a8XQJap: 'business_type',
  bMRRvfMDR7XSxJqob0hA: 'tier',
  '2TTc7pysPoIkpiraXcgX': 'owner_name',
  RFj1VlGRDeRor1RXCPfR: 'google_score',
  YQ4frCnKOqutuX1nIZOf: 'hook_note',
  Kwkn2dvAU1mvWNJbqVpE: 'warning',
  '2XL9Hj5BS4M4UHgAkNNs': 'last_outcome',
};

function mapContactToLead(contact) {
  const customFields = {};
  const rawFields = contact.customFields || contact.customField || [];
  rawFields.forEach(f => {
    const name = CUSTOM_FIELD_IDS[f.id] || f.id;
    customFields[name] = f.value ?? f.field_value ?? '';
  });

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

    businessType: customFields['business_type'] || '',
    tier: customFields['tier'] || 2,
    ownerName: customFields['owner_name'] || '',
    googleScore: customFields['google_score'] || '',
    hookNote: customFields['hook_note'] || '',
    warning: customFields['warning'] || '',
    lastOutcome: customFields['last_outcome'] || '',

    // Status comes from our last_outcome custom field, not tags
    status: customFields['last_outcome'] || 'New',
    assignedAgent: contact.assignedTo || '',
    lastActivity: contact.lastActivity || null,
    dateAdded: contact.dateAdded || null,
  };
}


// ═══════════ STATS HELPERS ═══════════

/**
 * Get stats for an agent or the whole team
 */
/**
 * Find a contact by exact phone number — used for duplicate detection on import
 */
export async function findContactByPhone(phone) {
  const LOCATION_ID = process.env.GHL_LOCATION_ID;
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  try {
    const data = await ghlRequest(
      `/contacts/?locationId=${LOCATION_ID}&limit=5&query=${encodeURIComponent(digits)}`
    );
    const contacts = data.contacts || [];
    return contacts.find(c => c.phone && c.phone.replace(/\D/g, '') === digits) || null;
  } catch {
    return null; // treat lookup failure as no-duplicate so we don't lose the lead
  }
}

/**
 * Normalize any phone format to E.164 (+1XXXXXXXXXX for US numbers)
 */
function toE164(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Create a new contact (lead) in GHL — used by the CSV import flow
 */
export async function createContact(lead, assignment = {}) {
  const LOCATION_ID = process.env.GHL_LOCATION_ID;

  const phone = toE164(lead.phone);
  const googleScore = lead.rating && lead.reviews
    ? `${lead.rating} (${lead.reviews} reviews)`
    : lead.rating || '';

  const customFields = [
    { id: '2XL9Hj5BS4M4UHgAkNNs', value: 'New' }, // last_outcome
  ];
  if (assignment.businessType) {
    customFields.push({ id: 'x8DJVqauQaM35a8XQJap', value: assignment.businessType });
  }
  if (assignment.tier) {
    customFields.push({ id: 'bMRRvfMDR7XSxJqob0hA', value: String(assignment.tier) });
  }
  if (googleScore) {
    customFields.push({ id: 'RFj1VlGRDeRor1RXCPfR', value: googleScore });
  }

  const body = {
    locationId:  LOCATION_ID,
    companyName: lead.name,
    firstName:   lead.name,
    phone,
    city:        lead.city    || '',
    state:       lead.state   || '',
    website:     lead.website || '',
    assignedTo:  assignment.agentId || '',
    tags:        assignment.campaign ? [assignment.campaign] : [],
    customFields,
  };

  console.log('[IMPORT] Creating contact:', lead.name, phone, '→ assignedTo:', assignment.agentId || '(unassigned)');
  return ghlRequest('/contacts/', { method: 'POST', body: JSON.stringify(body) });
}

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
  findContactByPhone,
  createContact,
};
