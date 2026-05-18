import { UserCheck } from 'lucide-react';

export default function Agents() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Agents</h1>
          <p className="page-subtitle">Manage agents, bulk-assign leads, view phone numbers</p>
        </div>
      </div>

      <div className="placeholder-wrap">
        <UserCheck size={32} color="var(--text3)" />
        <div className="placeholder-title">Agent Management</div>
        <p className="placeholder-sub">
          Agent cards with stats, assigned lead counts, and bulk assignment tools. Coming in Day 5.
        </p>
      </div>
    </div>
  );
}
