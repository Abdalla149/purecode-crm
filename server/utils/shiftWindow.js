// ═══════════════════════════════════════════════════════════
// Pacific-time boundaries (epoch ms). Used so "Calls Today" can
// reset every 12 hours (00:00 and 12:00 America/Los_Angeles),
// while other daily metrics stay on the calendar day.
// DST-safe: offsets are read from Intl at the target instant.
// ═══════════════════════════════════════════════════════════
const TZ = 'America/Los_Angeles';

// UTC epoch (ms) for a given Pacific wall-clock time.
function ptWallClockToUtcMs(y, mo, d, h) {
  const guess = Date.UTC(y, mo - 1, d, h, 0, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const seenUtc = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return guess - (seenUtc - guess); // guess minus the tz offset at that instant
}

// Current Pacific date/hour parts.
function ptNowParts() {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: (+p.hour) % 24 };
}

// Start of the current calendar day, Pacific time.
export function dayStartMsPT() {
  const { y, mo, d } = ptNowParts();
  return ptWallClockToUtcMs(y, mo, d, 0);
}

// Start of the current 12-hour shift (00:00 or 12:00 Pacific).
export function shiftStartMsPT() {
  const { y, mo, d, h } = ptNowParts();
  return ptWallClockToUtcMs(y, mo, d, h < 12 ? 0 : 12);
}
