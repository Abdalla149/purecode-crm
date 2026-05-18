import { TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MyStats() {
  const { user } = useAuth();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-h1">My Stats</h1>
          <p className="page-subtitle">Your personal performance — calls, demos, closes</p>
        </div>
      </div>

      <div className="placeholder-wrap">
        <TrendingUp size={32} color="var(--text3)" />
        <div className="placeholder-title">Performance Stats</div>
        <p className="placeholder-sub">
          Daily call count, demo rate, close rate, and pipeline value for {user?.name}. Coming in Day 4.
        </p>
      </div>
    </div>
  );
}
