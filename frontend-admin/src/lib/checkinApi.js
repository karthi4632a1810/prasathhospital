import { request } from './api';

export const checkinApi = {
  events: () => request('/admin/checkin/events'),
  scan: (qrToken) => request('/admin/checkin/scan', { method: 'POST', body: { qrToken } }),
  stats: (eventId) => request(`/admin/checkin/stats?event=${encodeURIComponent(eventId)}`),
};
