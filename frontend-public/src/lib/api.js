const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Thin fetch wrapper that unwraps the API's { success, data } envelope and
 * turns failures into a single ApiError shape the UI can render.
 */
async function request(path, { signal, ...options } = {}) {
  let response;

  try {
    response = await fetch(`${BASE_URL}/api/v1${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal,
      ...options,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(
      'We could not reach the server. Please check your connection and try again.',
      0
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('The server returned an unexpected response.', response.status);
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.error?.message || 'Something went wrong. Please try again.',
      response.status,
      payload?.error?.details
    );
  }

  return payload;
}

export const api = {
  getEvent: (slug, opts) => request(`/public/events/${encodeURIComponent(slug)}`, opts),
  listEvents: (query = '', opts) => request(`/public/events${query}`, opts),
  getTicketTypes: (slug, opts) =>
    request(`/public/events/${encodeURIComponent(slug)}/ticket-types`, opts),
  validateCoupon: (payload, opts) =>
    request('/coupons/validate', { method: 'POST', body: JSON.stringify(payload), ...opts }),
  register: (payload, opts) =>
    request('/registrations', { method: 'POST', body: JSON.stringify(payload), ...opts }),
  getTicket: (qrToken, opts) => request(`/tickets/${encodeURIComponent(qrToken)}`, opts),
  submitFeedback: (payload, opts) =>
    request('/feedback', { method: 'POST', body: JSON.stringify(payload), ...opts }),
};
