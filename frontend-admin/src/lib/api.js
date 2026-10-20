const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'prashanth_admin_token';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing / storage blocked — session just won't persist */
  }
}

/** Set by AuthProvider so a 401 from any request can force a sign-out. */
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/**
 * Thin fetch wrapper that unwraps the API's { success, data } envelope,
 * attaches the admin bearer token, and turns failures into a single
 * ApiError shape the UI can render. Mirrors frontend-public/src/lib/api.js
 * so both apps stay easy to read side by side.
 */
async function request(path, { signal, body, headers, retries = 2, retryDelay = 2500, ...options } = {}) {
  const token = getToken();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1${path}`, {
        headers: {
          ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(headers || {}),
        },
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
        signal,
        ...options,
      });

      if ([502, 503, 504].includes(response.status) && attempt < retries) {
        await new Promise((res) => setTimeout(res, retryDelay));
        continue;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        if (attempt < retries) {
          await new Promise((res) => setTimeout(res, retryDelay));
          continue;
        }
        throw new ApiError('The server is warming up. Please try again in a moment.', response.status);
      }

      if (response.status === 401) onUnauthorized();

      if (!response.ok || !payload?.success) {
        throw new ApiError(
          payload?.error?.message || 'Something went wrong. Please try again.',
          response.status,
          payload?.error?.details
        );
      }

      return payload;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (attempt < retries && (err.name === 'TypeError' || err.status === 0 || [502, 503, 504].includes(err.status))) {
        await new Promise((res) => setTimeout(res, retryDelay));
        continue;
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        'We could not reach the server. Please check your connection and try again.',
        0
      );
    }
  }
}

export const api = {
  login: (email, password) =>
    request('/admin/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/admin/auth/me'),
};

export { request };
