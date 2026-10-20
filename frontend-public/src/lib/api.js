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
 * Fetch wrapper that unwraps the API's { success, data } envelope.
 * Automatically retries if cloud server is waking up from idle (cold start).
 */
async function request(path, { signal, retries = 2, retryDelay = 2500, ...options } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1${path}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        signal,
        ...options,
      });

      // Cold start gateway responses (502/503/504)
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
