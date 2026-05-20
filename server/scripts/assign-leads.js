import 'dotenv/config';

const GHL_BASE    = process.env.GHL_BASE_URL;
const GHL_KEY     = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

const AGENTS = [
  { name: 'Lucas', id: '7c0sDQ3oEzttlQfa3jAA', quota: 25 },
  { name: 'Harry', id: 'EFYhirIwNFKAY04HjbbK', quota: 25 },
  { name: 'Jim',   id: 'CUqipGSIfqu2o7bcWroN', quota: 25 },
  { name: 'Bruce', id: 'hHYQ1Yk7EZhxjjFYYGln', quota: 25 },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ghl(endpoint, options = {}) {
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GHL_KEY}`,
      'Content-Type':  'application/json',
      'Version':       '2021-07-28',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchTaggedContacts(tag, limit = 100) {
  const contacts = [];
  let startAfter = null;
  let page = 1;

  while (contacts.length < limit) {
    const pageSize = Math.min(limit - contacts.length, 100);
    let url = `/contacts/?locationId=${LOCATION_ID}&tag=${encodeURIComponent(tag)}&limit=${pageSize}`;
    if (startAfter) url += `&startAfter=${startAfter}`;

    const data = await ghl(url);
    const batch = data.contacts || [];
    contacts.push(...batch);

    console.log(`  Page ${page}: fetched ${batch.length} contacts (total so far: ${contacts.length})`);

    if (!data.meta?.nextPageUrl || batch.length < pageSize) break;
    startAfter = data.meta.startAfterId || null;
    page++;
    if (!startAfter) break;
  }

  return contacts.slice(0, limit);
}

async function main() {
  console.log('════════════════════════════════════════════════');
  console.log('  PURECODE — Lead Assignment');
  console.log('════════════════════════════════════════════════\n');

  // ── 1. Fetch contacts ─────────────────────────────────
  console.log('Fetching 100 contacts tagged ca-roofing...');
  const contacts = await fetchTaggedContacts('ca-roofing', 100);
  console.log(`\nFetched: ${contacts.length} contacts\n`);

  if (contacts.length === 0) {
    console.log('No contacts found — aborting.');
    return;
  }

  // ── 2. Build assignment list ──────────────────────────
  const assignments = [];
  let idx = 0;
  for (const agent of AGENTS) {
    const slice = contacts.slice(idx, idx + agent.quota);
    slice.forEach(c => assignments.push({ contact: c, agent }));
    idx += agent.quota;
  }

  console.log('Assignment plan:');
  AGENTS.forEach(a => console.log(`  ${a.name}: ${a.quota} contacts`));
  console.log('');

  // ── 3. Execute in batches of 10 (rate-limit safe) ────
  const results = { success: [], errors: [] };
  const BATCH   = 10;
  const DELAY   = 400; // ms between requests

  for (let i = 0; i < assignments.length; i++) {
    const { contact, agent } = assignments[i];
    const label = `${contact.companyName || contact.firstName || '?'} — ${contact.phone || '?'}`;

    if (i > 0 && i % BATCH === 0) {
      // Brief pause between batches
      await sleep(DELAY);
      console.log(`  ─── batch ${Math.floor(i / BATCH)} complete ───`);
    }

    try {
      await ghl(`/contacts/${contact.id}`, {
        method: 'PUT',
        body: JSON.stringify({ assignedTo: agent.id }),
      });
      console.log(`  ✓ [${String(i+1).padStart(3)}] ${agent.name.padEnd(6)} ← ${label}`);
      results.success.push({ contactId: contact.id, name: label, assignedTo: agent.name });
    } catch (err) {
      console.error(`  ✗ [${String(i+1).padStart(3)}] ${agent.name.padEnd(6)} ← ${label} — ${err.message}`);
      results.errors.push({ contactId: contact.id, name: label, error: err.message });
    }
  }

  // ── 4. Summary ────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log('  Assignment complete');
  AGENTS.forEach(a => {
    const n = results.success.filter(r => r.assignedTo === a.name).length;
    console.log(`  ${a.name.padEnd(8)}: ${n} assigned`);
  });
  console.log(`  Errors  : ${results.errors.length}`);
  console.log('════════════════════════════════════════════════');

  if (results.errors.length) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  ✗ ${e.name} — ${e.error}`));
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
