import { request } from './api';

export const checkinApi = {
  events: () => request('/admin/checkin/events'),
  scan: (qrToken, locationOrOptions, maybeCode) => {
    const body = { qrToken };
    if (typeof locationOrOptions === 'object' && locationOrOptions !== null) {
      if (locationOrOptions.locationId || locationOrOptions.id) {
        body.locationId = locationOrOptions.locationId || locationOrOptions.id;
      }
      if (locationOrOptions.locationCode || locationOrOptions.code) {
        body.locationCode = locationOrOptions.locationCode || locationOrOptions.code;
      }
    } else {
      if (locationOrOptions) body.locationId = locationOrOptions;
      if (maybeCode) body.locationCode = maybeCode;
    }
    return request('/admin/checkin/scan', { method: 'POST', body });
  },
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
