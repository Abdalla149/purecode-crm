import { computeNextAction } from '../utils/next_action';

const COLOR_CLASS = {
  'green':      'na-green',
  'yellow':     'na-yellow',
  'red':        'na-red',
  'orange':     'na-orange',
  'purple':     'na-purple',
  'green-glow': 'na-green-glow',
  'gray':       'na-gray',
  'gray-light': 'na-gray',
};

export default function NextActionBadge({ lead, onClick, size = 'sm' }) {
  const { color, text, action } = computeNextAction(lead);
  const cls = COLOR_CLASS[color] || 'na-gray';
  const isClickable = action !== null && onClick;

  return (
    <span
      className={`na-badge ${cls}${size === 'lg' ? ' na-lg' : ''}${isClickable ? ' na-clickable' : ''}`}
      onClick={isClickable ? (e) => { e.stopPropagation(); onClick(action, lead); } : undefined}
      title={isClickable ? `Click to: ${text}` : text}
    >
      {text}
    </span>
  );
}
