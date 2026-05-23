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
    let errMsg = `status ${res.status}`;
    let parsedBody = null;
    try {
      parsedBody = JSON.parse(errBody);
      errMsg = parsedBody.message || parsedBody.msg || parsedBody.error || errBody || errMsg;
    } catch {
      if (errBody) errMsg = errBody;
    }
    const err = new Error(`CRM request failed (${res.status}): ${errMsg}`);
    err.ghlStatus = res.status;
    err.ghlBody   = errBody;
    err.ghlParsed = parsedBody;
    throw err;
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
    tags: contact.tags || [],
  };
}


// ═══════════ STATS HELPERS ═══════════

/**
 * Find an existing contact by phone using GHL's dedicated duplicate-search endpoint.
 * Returns the raw GHL contact object (with .id) or null.
 */
export async function findDuplicateContact(phone) {
  const LOCATION_ID = process.env.GHL_LOCATION_ID;
  const e164 = toE164(phone);
  if (!e164) return null;

  console.log(`[GHL LOOKUP] POST /contacts/search/duplicate phone=${e164}`);
  try {
    const data = await ghlRequest('/contacts/search/duplicate', {
      method: 'POST',
      body: JSON.stringify({ locationId: LOCATION_ID, phone: e164 }),
    });
    console.log(`[GHL LOOKUP] Raw response:`, JSON.stringify(data).slice(0, 300));
    // GHL may return { contact: {...} } or { contacts: [...] }
    const contact = data.contact || (Array.isArray(data.contacts) ? data.contacts[0] : null) || null;
    if (contact?.id) {
      console.log(`[GHL LOOKUP] Found contact id=${contact.id}`);
    } else {
      console.log(`[GHL LOOKUP] No existing contact found for ${e164}`);
    }
    return contact;
  } catch (err) {
    console.error(`[GHL LOOKUP] search/duplicate failed for ${e164}:`, err.message);
    return null;
  }
}

/**
 * Update an existing contact during import — sets assignedTo, custom fields, campaign tag.
 * Only overwrites fields we have new values for.
 */
export async function updateExistingContact(contactId, lead, assignment = {}) {
  const googleScore = lead.rating && lead.reviews
    ? `${lead.rating} (${lead.reviews} reviews)`
    : lead.rating || '';

  const customFields = [];
  if (assignment.businessType) customFields.push({ id: 'x8DJVqauQaM35a8XQJap', value: assignment.businessType });
  if (assignment.tier)         customFields.push({ id: 'bMRRvfMDR7XSxJqob0hA', value: String(assignment.tier) });
  if (googleScore)             customFields.push({ id: 'RFj1VlGRDeRor1RXCPfR', value: googleScore });

  const body = {};
  if (customFields.length)   body.customFields = customFields;
  if (assignment.agentId)    body.assignedTo   = assignment.agentId;

  console.log(`[GHL UPDATE] PUT /contacts/${contactId}`, JSON.stringify(body));
  const result = await ghlRequest(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  console.log(`[GHL UPDATE] Success for ${contactId}`);

  if (assignment.campaign) {
    await addTags(contactId, [assignment.campaign]);
  }

  return result;
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
    locationId:   LOCATION_ID,
    companyName:  lead.name || '',
    firstName:    lead.name || '',
    lastName:     '',
    phone,
    customFields,
  };
  if (lead.city)           body.city       = lead.city;
  if (lead.state)          body.state      = lead.state;
  if (lead.website)        body.website    = lead.website;
  if (assignment.agentId)  body.assignedTo = assignment.agentId;
  if (assignment.campaign) body.tags       = [assignment.campaign];

  console.log('[IMPORT] Creating contact:', lead.name, phone, '→ assignedTo:', assignment.agentId || '(unassigned)');
  console.log('[IMPORT] Payload:', JSON.stringify(body, null, 2));
  return ghlRequest('/contacts/', { method: 'POST', body: JSON.stringify(body) });
}

/**
 * Add tags to a contact — merges with existing tags
 */
export async function addTags(contactId, newTags) {
  // Use the dedicated tags endpoint which adds without replacing
  return ghlRequest(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags: newTags }),
  });
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
  findDuplicateContact,
  updateExistingContact,
  createContact,
  addTags,
};
