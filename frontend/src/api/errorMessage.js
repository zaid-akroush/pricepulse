// Turns an axios failure into a message that names the actual problem.
//
// Every form used to fall back to its own guess ("Login failed. Check your
// credentials.") whenever the response body had no `error` field. But that
// case is precisely the one where the credentials are NOT the problem: axios
// leaves `err.response` undefined when the request never got an answer at
// all — the API is not running, the URL is wrong, or the browser blocked the
// response because the origin is not in the backend's CORS allow-list. So
// the one message shown was the one explanation that could not be true, and
// it sent you off checking a password that was fine.
//
// `fallback` is used only for a real response whose body carried no message.

import api from './axios';

export function apiBaseUrl() {
  const base = api.defaults.baseURL || '/api';
  return base.startsWith('http') ? base : `${window.location.origin}${base}`;
}

export function describeApiError(err, fallback = 'The request failed.') {
  // Sent, but no response: server down, wrong address, DNS, or CORS.
  if (!err?.response) {
    const where = apiBaseUrl();
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || '')) {
      return `The server at ${where} did not respond in time. It may be starting up — try again in a moment.`;
    }
    return `Could not reach the server at ${where}. It is either not running, or it refused the response because this site's address is not in the backend's CLIENT_URL allow-list (a CORS block). Your credentials were never checked. The browser console shows which of the two it is.`;
  }

  const { status, data } = err.response;
  const message = typeof data === 'string' ? data : data?.error;

  if (message) return message;
  if (status === 401 || status === 403) return 'Those credentials were not accepted.';
  if (status === 404) return `The API responded 404 — ${apiBaseUrl()} is reachable but this endpoint does not exist there. Check VITE_API_URL points at the backend.`;
  if (status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (status >= 500) return `The server failed with HTTP ${status}. This is a backend fault, not your credentials — check the backend log.`;
  return fallback;
}

// The admin-only diagnosis block, when the backend attached one.
export function apiDiagnostic(err) {
  return err?.response?.data?.diagnostic || null;
}
