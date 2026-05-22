#!/usr/bin/env node
// ── One-time script: list all JustCall users with their IDs and phone numbers ──
// Run: node server/scripts/fetch-justcall-users.js
// Uses v2.1 API with Basic auth (api_key:api_secret)

const API_KEY    = process.env.JUSTCALL_API_KEY    || 'b573d348cb7fce8de100982fc01c93f8c83cdb40';
const API_SECRET = process.env.JUSTCALL_API_SECRET || '680169cb3cdb9355fd2e8f2ad0fe195924248eb3';

const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

async function fetchUsers() {
  console.log('Fetching JustCall users…\n');

  const res = await fetch('https://api.justcall.io/v2.1/users', {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept':        'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`HTTP ${res.status}:`, body);
    process.exit(1);
  }

  const json = await res.json();

  // v2.1 response shape: { status, data: { data: [...] } } or { status, data: [...] }
  const rows = json?.data?.data ?? json?.data ?? [];

  if (!rows.length) {
    console.log('No users returned. Raw response:');
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  console.log('JustCall Users\n' + '─'.repeat(72));
  rows.forEach(u => {
    const phones = (u.phone_numbers ?? u.numbers ?? [])
      .map(p => p.phone_number ?? p.number ?? p)
      .join(', ') || '(none)';

    console.log(`ID:    ${u.id}`);
    console.log(`Name:  ${u.first_name ?? ''} ${u.last_name ?? ''}`.trim());
    console.log(`Email: ${u.email ?? '(none)'}`);
    console.log(`Phone: ${phones}`);
    console.log('─'.repeat(72));
  });

  console.log(`\nTotal: ${rows.length} users`);
  console.log('\nRaw JSON (for reference):');
  console.log(JSON.stringify(rows.map(u => ({
    id:    u.id,
    name:  `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
    email: u.email,
    phone: (u.phone_numbers ?? u.numbers ?? []).map(p => p.phone_number ?? p.number ?? p),
  })), null, 2));
}

fetchUsers().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
