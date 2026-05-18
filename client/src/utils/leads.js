export function parseGoogleScore(raw) {
  if (!raw) return null;
  const m = String(raw).match(/^([\d.]+)\s*\((\d+)\s*reviews?\)?/i);
  if (m) return { score: m[1], reviews: m[2] };
  const plain = String(raw).match(/^([\d.]+)/);
  if (plain) return { score: plain[1], reviews: null };
  return null;
}

export function formatGoogleScore(raw) {
  const p = parseGoogleScore(raw);
  if (!p) return null;
  return p.reviews ? `⭐ ${p.score} (${p.reviews} reviews)` : `⭐ ${p.score}`;
}

export function generateHook(lead) {
  if (lead.hookNote) return lead.hookNote;
  const p = parseGoogleScore(lead.googleScore);
  if (!p) return null;
  return p.reviews
    ? `Google rating: ${p.score} with ${p.reviews} reviews — lead with that.`
    : `Google rating: ${p.score} — lead with that.`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
