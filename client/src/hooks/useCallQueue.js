import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toE164 } from '../utils/leads';
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

    const phone = toE164(lead.phone);
    if (!phone) {
      showWarning('This lead has no phone number');
      return;
    }

    // Fire tel: link — JustCall extension intercepts this and places the call
    const a = document.createElement('a');
    a.href = `tel:${phone}`;
    a.style.cssText = 'display:none;position:fixed;top:-9999px';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Open in-call overlay
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
