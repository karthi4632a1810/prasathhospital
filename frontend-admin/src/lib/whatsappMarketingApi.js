import { request } from './api';

export const whatsappMarketingApi = {
  getConfig: () => request('/admin/whatsapp-marketing/config'),
  sendTestSingle: (data) =>
    request('/admin/whatsapp-marketing/test-single', {
      method: 'POST',
      body: data,
    }),
  sendBatch: (data) =>
    request('/admin/whatsapp-marketing/send-batch', {
      method: 'POST',
      body: data,
    }),
};
