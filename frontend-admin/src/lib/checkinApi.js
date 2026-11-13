import { request } from './api';

export const checkinApi = {
  events: () => request('/admin/checkin/events'),
  scan: (qrToken, locationId) =>
    request('/admin/checkin/scan', {
      method: 'POST',
      body: { qrToken, ...(locationId ? { locationId } : {}) },
    }),
  stats: (eventId, location) =>
    request(
      `/admin/checkin/stats?event=${encodeURIComponent(eventId)}${
        location ? `&location=${encodeURIComponent(location)}` : ''
      }`
    ),
  locations: (eventId) => request(`/admin/checkin/locations?event=${encodeURIComponent(eventId)}`),
  createLocation: (body) => request('/admin/checkin/locations', { method: 'POST', body }),
  updateLocation: (id, body) => request(`/admin/checkin/locations/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  deleteLocation: (id) => request(`/admin/checkin/locations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
