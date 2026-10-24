import { request } from './api';

export const whatsappMarketingApi = {
  getConfig: () => request('/admin/whatsapp-marketing/config'),
  getCampaigns: () => request('/admin/whatsapp-marketing/campaigns'),
  getCampaignById: (id) => request(`/admin/whatsapp-marketing/campaigns/${id}`),
  deleteCampaign: (id) =>
    request(`/admin/whatsapp-marketing/campaigns/${id}`, { method: 'DELETE' }),
  uploadImage: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/admin/uploads', { method: 'POST', body: form });
  },
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
