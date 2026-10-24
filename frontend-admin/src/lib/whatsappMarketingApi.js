import { request } from './api';

export const whatsappMarketingApi = {
  getConfig: () => request('/admin/whatsapp-marketing/config'),
  sendTestSingle: (data) =>
    request('/admin/whatsapp-marketing/test-single', {
      method: 'POST',
      body: data,
    }),
  resendSingle: (data) =>
    request('/admin/whatsapp-marketing/resend-single', {
      method: 'POST',
      body: data,
    }),
  sendBatch: (data) =>
    request('/admin/whatsapp-marketing/send-batch', {
      method: 'POST',
      body: data,
    }),
  checkStatuses: (data) =>
    request('/admin/whatsapp-marketing/check-statuses', {
      method: 'POST',
      body: data,
    }),
};
