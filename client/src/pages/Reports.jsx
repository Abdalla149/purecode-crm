import { BarChart2 } from 'lucide-react';

export default function Reports() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">Reports</h1>
          <p className="page-subtitle">Performance reports and call analytics</p>
        </div>
      </div>

      <div className="placeholder-wrap">
        <BarChart2 size={32} color="var(--text3)" />
        <div className="placeholder-title">Reports</div>
        <p className="placeholder-sub">
          Daily/weekly call reports, conversion rates, and pipeline value. Coming in Day 5.
        </p>
      </div>
    </div>
  );
}
