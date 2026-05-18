import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ requiredRole }) {
  const { token, user } = useAuth();

  if (!token) return <Navigate to="/login" replace />;

  if (requiredRole && user?.role !== requiredRole) {
    const fallback = user?.role === 'admin' ? '/dashboard' : '/my-queue';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
