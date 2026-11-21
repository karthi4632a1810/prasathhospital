import { request } from './api';
import { downloadCsv, downloadFile } from './download';

/** Drops empty filters and formats arrays as comma-separated values. */
export function toQuery(params) {
  const clean = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v === '' || v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length > 0) clean[k] = v.join(',');
      continue;
    }
    clean[k] = v;
  }
  return new URLSearchParams(clean).toString();
}

export const registrationApi = {
  list: (params) => request(`/admin/registrations?${toQuery(params)}`),
  get: (id) => request(`/admin/registrations/${id}`),
  create: (body) => request('/admin/registrations', { method: 'POST', body }),
  update: (id, body) => request(`/admin/registrations/${id}`, { method: 'PATCH', body }),
  toggleCheckinLocation: (id, { locationId, locationCode, checked }) =>
    request(`/admin/registrations/${id}/checkin-location`, {
      method: 'POST',
      body: { locationId, locationCode, checked },
    }),
  delete: (id) => request(`/admin/registrations/${id}`, { method: 'DELETE' }),
  cancel: (id, reason) =>
    request(`/admin/registrations/${id}/cancel`, { method: 'POST', body: { reason } }),
  retryDelivery: (id, channel) =>
    request(`/admin/registrations/${id}/deliveries/${channel}`, { method: 'POST' }),
  exportCsv: (params) =>
    downloadCsv(`/admin/registrations/export.csv?${toQuery(params)}`, 'registrations.csv'),
  exportScannedAttendanceXlsx: (params) => {
    const dateStr = new Date().toISOString().slice(0, 10);
    return downloadFile(
      `/admin/registrations/export-attendance.xlsx?${toQuery(params)}`,
      `TNMC_Bulk_Upload_Attendance_${dateStr}.xlsx`
    );
  },
  downloadBadge: (id, { role, name, template, showQr, showBadgeNo, badgeNo, format = 'pdf' } = {}, filename) => {
    const fmt = (format || 'pdf').toLowerCase().replace(/^\./, '');
    const q = toQuery({
      role,
      name,
      template: template ? 'true' : undefined,
      showQr: showQr === false ? 'false' : undefined,
      showBadgeNo: showBadgeNo === false ? 'false' : undefined,
      badgeNo: badgeNo || undefined,
      format: fmt,
    });
    return downloadFile(
      `/admin/registrations/${id}/badge${q ? `?${q}` : ''}`,
      filename || `ID-CARD-${id}.${fmt}`
    );
  },
  downloadBadgePdf: (id, opts = {}, filename) =>
    registrationApi.downloadBadge(id, { ...opts, format: 'pdf' }, filename),
  downloadCertificate: (id, { name, format = 'pdf' } = {}, filename) => {
    const fmt = (format || 'pdf').toLowerCase().replace(/^\./, '');
    const q = toQuery({ name, format: fmt });
    return downloadFile(
      `/admin/registrations/${id}/certificate?${q}`,
      filename || `CIIM2026-CERTIFICATE-${id}.${fmt}`
    );
  },
  getCertificateUrl: (id, { name, format = 'pdf', preview = false } = {}) => {
    const fmt = (format || 'pdf').toLowerCase().replace(/^\./, '');
    const q = toQuery({ name, format: fmt, preview: preview ? 'true' : undefined });
    return `/admin/registrations/${id}/certificate?${q}`;
  },
};
