import { request } from './api';
import { downloadFile } from './download';

export const aiApi = {
  chat: (message) =>
    request('/admin/ai/chat', {
      method: 'POST',
      body: { message },
    }),

  downloadCertificate: (name, format = 'pdf', filename) => {
    const encName = encodeURIComponent(name || 'Delegate');
    const fmt = (format || 'pdf').toLowerCase().replace(/^\./, '');
    const cleanFilename = filename || `CIIM2026_Certificate_${name.replace(/\s+/g, '_')}.${fmt}`;
    return downloadFile(
      `/admin/ai/download/certificate?name=${encName}&format=${fmt}`,
      cleanFilename
    );
  },

  downloadIdCard: (name, format = 'pdf', filename) => {
    const encName = encodeURIComponent(name || 'Delegate');
    const fmt = (format || 'pdf').toLowerCase().replace(/^\./, '');
    const cleanFilename = filename || `CIIM2026_IDCard_${name.replace(/\s+/g, '_')}.${fmt}`;
    return downloadFile(
      `/admin/ai/download/id-card?name=${encName}&format=${fmt}&includeTemplate=true`,
      cleanFilename
    );
  },

  downloadExcel: (fileId, filename) => {
    return downloadFile(
      `/admin/ai/download/excel/${fileId}`,
      filename || 'CIIM2026_Export.xlsx'
    );
  },

  downloadExport: (fileId, filename) => {
    return downloadFile(
      `/admin/ai/download/export/${fileId}`,
      filename || 'CIIM2026_Export'
    );
  },

  downloadPdf: (fileId, filename) => {
    return downloadFile(
      `/admin/ai/download/export/${fileId}`,
      filename || 'CIIM2026_Report.pdf'
    );
  },

  downloadCsv: (fileId, filename) => {
    return downloadFile(
      `/admin/ai/download/export/${fileId}`,
      filename || 'CIIM2026_Data.csv'
    );
  },
};
