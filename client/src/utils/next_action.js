/**
 * Computes the recommended next action for a lead based on its current state.
 * Returns: { color, text, action }
 *   color:  'green' | 'yellow' | 'red' | 'orange' | 'purple' | 'green-glow' | 'gray' | 'gray-light'
 *   text:   human-readable badge label
 *   action: 'welcome' | 'followup' | 'call' | 'demo-prep' | 'notify' | null
 */
export function computeNextAction(lead) {
  const status = lead.status || 'New';
  const tags   = lead.tags   || [];

  if (status === 'Not Qualified') {
    return { color: 'gray', text: 'Lost — no action', action: null };
  }

  if (status === 'Closed') {
    return { color: 'green-glow', text: 'Notify David — commission due!', action: 'notify' };
  }

  if (status === 'Demo Booked') {
    return { color: 'purple', text: 'Prep for demo', action: 'demo-prep' };
  }

  // Detect welcome email tag and extract sent date
  const welcomeDateTag = tags.find(t => /^welcome-email-sent-\d{4}-\d{2}-\d{2}$/.test(t));
  const hasWelcomeTag  = tags.includes('welcome-email-sent') || !!welcomeDateTag;

  if (hasWelcomeTag) {
    let hoursAgo = null;
    if (welcomeDateTag) {
      const datePart = welcomeDateTag.replace('welcome-email-sent-', '');
      const sent = new Date(datePart);
      if (!isNaN(sent.getTime())) {
        hoursAgo = (Date.now() - sent.getTime()) / 3_600_000;
      }
    }

    if (hoursAgo === null || hoursAgo < 48) {
      return { color: 'yellow', text: 'Wait — not opened yet', action: null };
    }
    return { color: 'red', text: 'Send follow-up email', action: 'followup' };
  }

  // Called but no welcome email sent yet
  if (['Called', 'Interested', 'Callback', 'No Answer', 'Voicemail'].includes(status)) {
    return { color: 'green', text: 'Send welcome email now', action: 'welcome' };
  }

  return { color: 'gray-light', text: 'Review lead', action: null };
}

/** Returns the Kanban column id a lead belongs to */
export function getLeadColumn(lead) {
  const tags = lead.tags || [];
  const hasWelcome = tags.includes('welcome-email-sent');

  if (lead.status === 'Not Qualified') return 'lost';
  if (lead.status === 'Closed')        return 'closed';
  if (lead.status === 'Demo Booked')   return 'demo';
  if (lead.status === 'Interested' || hasWelcome) return 'interested';
  return null; // Called/No Answer/Voicemail/Callback and New don't appear in the pipeline
}

/** Maps a kanban column id → the GHL status to set when a card is dropped there */
export const COLUMN_STATUS = {
  interested:'Interested',
  email:     null,          // Phase 2 placeholder — no status change
  demo:      'Demo Booked',
  closed:    'Closed',
  lost:      'Not Qualified',
};
