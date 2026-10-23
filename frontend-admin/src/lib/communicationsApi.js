import { request } from './api';

export const communicationsApi = {
  getConfig: () => request('/admin/communications/config'),
  sendTestWhatsApp: (data) =>
    request('/admin/communications/whatsapp/test', {
      method: 'POST',
      body: data,
    }),
  sendTestEmail: (data) =>
    request('/admin/communications/email/test', {
      method: 'POST',
      body: data,
    }),
  previewEmail: (data) =>
    request('/admin/communications/email/preview', {
      method: 'POST',
      body: data,
    }),
};
