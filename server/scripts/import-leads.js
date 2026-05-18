#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// PURECODE — One-time CSV → GHL Contact Import
// ═══════════════════════════════════════════════════════════
//
// Usage (run from server/ directory):
//   node scripts/import-leads.js <path-to-csv>
//   node scripts/import-leads.js <path-to-csv> --dry-run
//   node scripts/import-leads.js <path-to-csv> --limit=20
//
// What it does:
//   - Reads every row from the CSV
//   - Skips rows with no phone number
//   - Creates (or updates) a GHL contact with:
//       companyName, phone, city, state, website
//       custom fields: business_type, tier, last_outcome, google_score
//       tag: CA-Roofing
//   - Rate-limited to ~150 req/min (400ms delay)
//   - Writes import-results.json when done
// ═══════════════════════════════════════════════════════════

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';

// ── CLI args ─────────────────────────────────────────────────
const CSV_PATH = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
const DRY_RUN  = process.argv.includes('--dry-run');
const LIMIT    = (() => {
  const a = process.argv.find(a => a.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : Infinity;
})();

if (!CSV_PATH) {
  console.error('Usage: node scripts/import-leads.js <path-to-csv> [--dry-run] [--limit=N]');
  process.exit(1);
}

// ── GHL config ────────────────────────────────────────────────
const GHL_BASE   = process.env.GHL_BASE_URL  || 'https://rest.gohighlevel.com/v1';
const GHL_KEY    = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const DELAY_MS   = 400; // ~150 req/min — safe for GHL rate limits

if (!GHL_KEY || !LOCATION_ID) {
  console.error('Missing GHL_API_KEY or GHL_LOCATION_ID in .env');
  process.exit(1);
}

// ── CSV parser (handles quoted fields with commas) ────────────
function parseCSVLine(line) {
  const fields = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(raw) {
  const lines = raw.split('\n').map(l => l.replace(/\r$/, ''));

  // Find the header row (first row that starts with a real value, not blank)
  const headerIdx = lines.findIndex(l => l.match(/^Name,/i));
  if (headerIdx === -1) throw new Error('Could not find header row (expected "Name,...")');

  const headers = parseCSVLine(lines[headerIdx]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows    = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    const row    = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
    rows.push(row);
  }

  return rows;
}

// ── Build GHL contact payload ─────────────────────────────────
function buildPayload(row) {
  const rating  = row['rating']?.trim();
  const reviews = (row['number_of_reviews'] || row['nor'])?.trim();
  const phone   = row['phone_number']?.trim();
  const website = row['website']?.trim();

  // google_score: "4.9 (120 reviews)" or just "4.9"
  let googleScore = '';
  if (rating) {
    googleScore = reviews && reviews !== '0'
      ? `${rating} (${reviews} reviews)`
      : rating;
  }

  return {
    locationId:  LOCATION_ID,
    companyName: row['name']?.trim() || '',
    phone,
    city:        row['city']?.trim()  || '',
    state:       row['state']?.trim() || '',
    ...(website ? { website } : {}),
    tags: ['CA-Roofing'],
    customFields: [
      { id: 'business_type', value: 'Roofing' },
      { id: 'tier',          value: '2' },
      { id: 'last_outcome',  value: 'New' },
      ...(googleScore ? [{ id: 'google_score', value: googleScore }] : []),
    ],
  };
}

// ── GHL API call ──────────────────────────────────────────────
class DuplicateContactError extends Error {
  constructor(existingId) {
    super('duplicate');
    this.existingId = existingId;
  }
}

async function createContact(payload, retries = 1) {
  const res = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GHL_KEY}`,
      'Content-Type':  'application/json',
      'Version':       '2021-07-28',
    },
    body: JSON.stringify(payload),
  });

  // 429 rate limit — wait and retry once
  if (res.status === 429 && retries > 0) {
    await sleep(2000);
    return createContact(payload, retries - 1);
  }

  if (!res.ok) {
    const body = await res.text();
    // Detect GHL's "no duplicates" rejection — treat as a skip, not a hard error
    if (res.status === 400) {
      try {
        const parsed = JSON.parse(body);
        if (parsed.message?.toLowerCase().includes('duplicat')) {
          throw new DuplicateContactError(parsed.meta?.contactId);
        }
      } catch (e) {
        if (e instanceof DuplicateContactError) throw e;
      }
    }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pad(n, len = 5) { return String(n).padStart(len, ' '); }

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  PURECODE — GHL Contact Import');
  console.log(`  CSV:      ${CSV_PATH}`);
  console.log(`  Mode:     ${DRY_RUN ? 'DRY RUN (no changes made)' : 'LIVE'}`);
  console.log(`  Location: ${LOCATION_ID}`);
  console.log('═══════════════════════════════════════════════\n');

  // Read + parse CSV
  let raw;
  try {
    raw = readFileSync(CSV_PATH, 'utf8');
  } catch {
    console.error(`Cannot read file: ${CSV_PATH}`);
    process.exit(1);
  }

  const rows = parseCSV(raw);
  console.log(`Parsed ${rows.length} data rows from CSV\n`);

  // Filter + limit
  const toImport = rows
    .filter(r => r['phone_number']?.trim())   // must have phone
    .slice(0, LIMIT);

  const skippedNoPhone = rows.length - rows.filter(r => r['phone_number']?.trim()).length;

  console.log(`Will import: ${toImport.length} contacts`);
  console.log(`Skipping:    ${skippedNoPhone} rows with no phone\n`);

  if (toImport.length === 0) {
    console.log('Nothing to import.');
    return;
  }

  const startTime = Date.now();
  const results   = { created: [], duplicates: [], skipped: [], errors: [] };

  for (let i = 0; i < toImport.length; i++) {
    const row     = toImport[i];
    const payload = buildPayload(row);
    const label   = `${payload.companyName || '(no name)'} — ${payload.phone}`;
    const prefix  = `[${pad(i + 1)}/${pad(toImport.length)}]`;

    if (DRY_RUN) {
      console.log(`${prefix} DRY  ${label}`);
      results.created.push({ name: payload.companyName, phone: payload.phone });
      continue;
    }

    try {
      const data = await createContact(payload);
      const contactId = data.contact?.id || data.id || '?';
      console.log(`${prefix} ✓  ${label}  [id: ${contactId}]`);
      results.created.push({ name: payload.companyName, phone: payload.phone, id: contactId });
    } catch (err) {
      if (err instanceof DuplicateContactError) {
        console.log(`${prefix} ⟳  ${label}  [already exists${err.existingId ? `: ${err.existingId}` : ''}]`);
        results.duplicates.push({ name: payload.companyName, phone: payload.phone, id: err.existingId });
      } else {
        console.error(`${prefix} ✗  ${label}`);
        console.error(`         ${err.message}`);
        results.errors.push({ name: payload.companyName, phone: payload.phone, error: err.message });
      }
    }

    // Rate limiting delay (skip on last row)
    if (i < toImport.length - 1) await sleep(DELAY_MS);

    // Print ETA every 50 rows
    if ((i + 1) % 50 === 0 && !DRY_RUN) {
      const elapsed = Date.now() - startTime;
      const rate    = (i + 1) / (elapsed / 1000);
      const etaSec  = Math.ceil((toImport.length - i - 1) / rate);
      console.log(`\n  ─── ${i + 1}/${toImport.length} done · ETA ${fmtDuration(etaSec * 1000)} ───\n`);
    }
  }

  // Track no-phone skips in results too
  rows
    .filter(r => !r['phone_number']?.trim())
    .forEach(r => results.skipped.push({ name: r['name'], reason: 'no phone' }));

  // Summary
  const duration = Date.now() - startTime;
  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Import ${DRY_RUN ? '(DRY RUN) ' : ''}complete`);
  console.log(`  Created:    ${results.created.length}`);
  console.log(`  Duplicates: ${results.duplicates.length} (already existed)`);
  console.log(`  Skipped:    ${results.skipped.length} (no phone)`);
  console.log(`  Errors:     ${results.errors.length}`);
  console.log(`  Time:    ${fmtDuration(duration)}`);
  console.log('═══════════════════════════════════════════════\n');

  if (results.errors.length > 0) {
    console.log('Errors:');
    results.errors.forEach(e => console.log(`  ✗ ${e.name} — ${e.error}`));
    console.log('');
  }

  // Write results log
  if (!DRY_RUN) {
    const outPath = `./scripts/import-results-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`Results written to ${outPath}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
