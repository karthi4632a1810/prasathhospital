import { request } from './api';
import { downloadCsv, downloadFile } from './download';

/** Drops empty filters so the URL (and the CSV export) only carry what's set. */
export function toQuery(params) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );
  return new URLSearchParams(clean).toString();
}

export const registrationApi = {
  list: (params) => request(`/admin/registrations?${toQuery(params)}`),
  get: (id) => request(`/admin/registrations/${id}`),
  update: (id, body) => request(`/admin/registrations/${id}`, { method: 'PATCH', body }),
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
  downloadBadgePdf: (id, { role, name, template, showQr, showBadgeNo, badgeNo } = {}, filename) => {
    const q = toQuery({
      role,
      name,
      template: template ? 'true' : undefined,
      showQr: showQr === false ? 'false' : undefined,
      showBadgeNo: showBadgeNo === false ? 'false' : undefined,
      badgeNo: badgeNo || undefined,
    });
    return downloadFile(
      `/admin/registrations/${id}/badge.pdf${q ? `?${q}` : ''}`,
      filename || `ID-CARD-${id}.pdf`
    );
  },
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
