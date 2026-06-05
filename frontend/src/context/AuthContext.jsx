import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from token in memory on mount
  useEffect(() => {
    const token = window.__pricepulse_token;
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { window.__pricepulse_token = null; })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    window.__pricepulse_token = data.token;
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password) {
    const { data } = await api.post('/auth/register', { name, email, password });
    window.__pricepulse_token = data.token;
    setUser(data.user);
    return data.user;
  }

  function logout() {
    window.__pricepulse_token = null;
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
