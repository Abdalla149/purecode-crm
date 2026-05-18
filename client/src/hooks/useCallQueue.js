import { useState } from 'react';
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
  const [activeCall, setActiveCall]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [callCounts, setCallCounts]   = useState(loadCallCounts);

  const activeNumber = phoneNumbers.length > 0
    ? getActiveNumber(phoneNumbers, callCounts)
    : null;

  function handleStartCall(lead) {
    if (!lead) return;
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
    api.post(`/leads/${lead.id}/call`, { agentNumbers: phoneNumbers }).catch(() => {});
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
    totalCalls: callCounts.callsToday || 0,
    handleStartCall,
    handleOutcome,
    closeCall: () => setActiveCall(null),
  };
}
