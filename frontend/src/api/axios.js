import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally. Only treat a 401 as an expired/invalid session (log out
// + redirect). Auth attempts that legitimately return 401, such as a wrong
// login password or a wrong current-password on the change-password form,
// must be left for the calling component to display inline, otherwise the
// user is bounced to /login and never sees the error.
const AUTH_ATTEMPT_URLS = ['/auth/login', '/auth/register', '/auth/password'];
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthAttempt = AUTH_ATTEMPT_URLS.some((u) => url.includes(u));
    if (err.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('pp_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
