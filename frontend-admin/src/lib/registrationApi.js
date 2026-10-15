import { request } from './api';
import { downloadCsv } from './download';

/** Drops empty filters so the URL (and the CSV export) only carry what's set. */
export function toQuery(params) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));
  return new URLSearchParams(clean).toString();
}

export const registrationApi = {
  list: (params) => request(`/admin/registrations?${toQuery(params)}`),
  get: (id) => request(`/admin/registrations/${id}`),
  update: (id, body) => request(`/admin/registrations/${id}`, { method: 'PATCH', body }),
  cancel: (id, reason) => request(`/admin/registrations/${id}/cancel`, { method: 'POST', body: { reason } }),
  retryDelivery: (id, channel) => request(`/admin/registrations/${id}/deliveries/${channel}`, { method: 'POST' }),
  exportCsv: (params) => downloadCsv(`/admin/registrations/export.csv?${toQuery(params)}`, 'registrations.csv'),
};
