import { useState } from 'react';
import { Check } from 'lucide-react';

const AVATAR_BG = { L: '#3B82F6', H: '#8B5CF6', J: '#F59E0B', B: '#EF4444' };

export default function AgentCardRow({ agents, selectedId, onSelect }) {
  const [hovered, setHovered] = useState(null);

  const cards = [
    { name: 'Unassigned', ghlUserId: '', count: null },
    ...agents,
  ];

  return (
    <>
      <style>{`.acr-scroll::-webkit-scrollbar{display:none}`}</style>
      <div className="acr-scroll" style={{
        display: 'flex', gap: 10,
        overflowX: 'auto', paddingBottom: 4,
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {cards.map(card => {
          const initials  = card.name === 'Unassigned' ? '—' : card.name[0];
          const isActive  = selectedId === card.ghlUserId;
          const isHover   = hovered === card.name;
          const avatarBg  = isActive ? 'var(--primary)' : (AVATAR_BG[initials] || 'var(--bg4)');

          return (
            <div
              key={card.ghlUserId}
              onClick={() => onSelect(card.ghlUserId)}
              onMouseEnter={() => setHovered(card.name)}
              onMouseLeave={() => setHovered(null)}
              style={{
                flexShrink: 0, scrollSnapAlign: 'start',
                width: 108, padding: '14px 10px 12px',
                borderRadius: 10, textAlign: 'center',
                border: `2px solid ${isActive ? 'var(--primary)' : isHover ? 'rgba(255,255,255,0.14)' : 'var(--border)'}`,
                background: isActive ? 'rgba(0,229,160,0.08)' : isHover ? 'var(--bg3)' : 'var(--bg2)',
                cursor: 'pointer', userSelect: 'none', position: 'relative',
                transition: 'border-color 0.13s, background 0.13s',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', top: 7, right: 7,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={10} color="#000" strokeWidth={3} />
                </div>
              )}

              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: avatarBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px',
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15,
                color: isActive ? '#000' : card.name === 'Unassigned' ? 'var(--text3)' : '#fff',
                border: card.name === 'Unassigned' && !isActive ? '1px dashed var(--border2)' : 'none',
                transition: 'background 0.13s',
              }}>
                {initials}
              </div>

              <div style={{
                fontSize: 12, fontWeight: 700,
                color: isActive ? 'var(--primary)' : 'var(--text)',
                marginBottom: card.count !== null ? 3 : 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {card.name}
              </div>

              {card.count !== null && (
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                  {card.count} leads
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
