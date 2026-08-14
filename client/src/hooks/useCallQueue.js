import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialer } from '../context/DialerContext';
import api from '../utils/api';

const CALL_LIMIT = 30;

// Pacific calendar day + 12-hour shift key (AM = 00:00–12:00, PM = 12:00–24:00).
function ptKeys() {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
  const day = `${p.year}-${p.month}-${p.day}`;
  return { day, shift: `${day}-${(+p.hour % 24) < 12 ? 'AM' : 'PM'}` };
}

function loadCallCounts() {
  const { day, shift } = ptKeys();
  try {
    const raw = JSON.parse(localStorage.getItem('purecode_call_counts') || 'null');
    if (raw) {
      return {
        day,
        shift,
        // Calls Today resets every 12h shift; per-number counts persist for the day
        callsToday: raw.shift === shift ? (raw.callsToday || 0) : 0,
        counts:     raw.day === day     ? (raw.counts || {})   : {},
      };
    }
  } catch {}
  return { day, shift, counts: {}, callsToday: 0 };
}

function saveCallCounts(data) {
  localStorage.setItem('purecode_call_counts', JSON.stringify(data));
}

export function getActiveNumber(phoneNumbers, callCounts) {
  for (const num of phoneNumbers) {
    if ((callCounts.counts?.[num.id] || 0) < CALL_LIMIT) return num;
  }
  return phoneNumbers[0];
}

export function useCallQueue() {
  const { user } = useAuth();
  const dialer   = useDialer();
  const phoneNumbers = user?.phoneNumbers || [];
  const [activeCall,  setActiveCall]  = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [callCounts,  setCallCounts]  = useState(loadCallCounts);
  const [dialWarning, setDialWarning] = useState(null);
  const warnTimer = useRef(null);

  const activeNumber = phoneNumbers.length > 0
    ? getActiveNumber(phoneNumbers, callCounts)
    : null;

  function showWarning(msg) {
    setDialWarning(msg);
    clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setDialWarning(null), 4000);
  }

  async function handleStartCall(lead) {
    if (!lead?.phone) {
      showWarning('This lead has no phone number');
      return;
    }

    const status = await dialer?.dialNumber(lead.phone);

    if (status === 'not-ready') {
      showWarning('Dialer is loading — try again in a moment');
      return;
    }
    if (status === 'error') {
      showWarning('Could not place call — try again');
      return;
    }

    setDialWarning(null);

    if (activeNumber) {
      const updated = {
        ...callCounts,
        counts: {
          ...callCounts.counts,
          [activeNumber.id]: (callCounts.counts?.[activeNumber.id] || 0) + 1,
        },
        callsToday: (callCounts.callsToday || 0) + 1,
      };
      setCallCounts(updated);
      saveCallCounts(updated);
    }

    setActiveCall({ lead });
  }

  async function handleOutcome(outcome, noteText, onSuccess) {
    if (!activeCall || saving) return;
    setSaving(true);
    try {
      await api.post(`/leads/${activeCall.lead.id}/note`, {
        text: noteText || '',
        outcome,
      });
      if (onSuccess) onSuccess(activeCall.lead.id, outcome);
    } catch {}
    finally {
      setSaving(false);
      setActiveCall(null);
    }
  }

  return {
    activeCall,
    saving,
    callCounts,
    phoneNumbers,
    activeNumber,
    totalCalls:  callCounts.callsToday || 0,
    dialWarning,
    handleStartCall,
    handleOutcome,
    closeCall: () => setActiveCall(null),
  };
}
