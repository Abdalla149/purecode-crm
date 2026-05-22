import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const CALL_LIMIT = 30;

function loadCallCounts() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw = JSON.parse(localStorage.getItem('purecode_call_counts') || 'null');
    if (raw?.date === today) return raw;
  } catch {}
  return { date: new Date().toISOString().split('T')[0], counts: {}, callsToday: 0 };
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

  function handleStartCall(lead) {
    if (!lead?.phone) {
      showWarning('This lead has no phone number');
      return;
    }

    // Show overlay immediately — call fires in background
    setDialWarning(null);
    setActiveCall({ lead });

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

    // Fire REST API call — agent's phone rings on their desktop/mobile app
    api.post('/calls/dial', {
      leadPhone: lead.phone,
      leadName:  lead.name || lead.companyName || '',
    }).catch(err => {
      console.error('[DIAL]', err?.response?.data?.error || err.message);
      // Overlay stays open — agent can still file an outcome manually
    });
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
