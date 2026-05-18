import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('purecode_token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('purecode_user');
    return stored ? JSON.parse(stored) : null;
  });

  function login(newToken, userData) {
    localStorage.setItem('purecode_token', newToken);
    localStorage.setItem('purecode_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('purecode_token');
    localStorage.removeItem('purecode_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
