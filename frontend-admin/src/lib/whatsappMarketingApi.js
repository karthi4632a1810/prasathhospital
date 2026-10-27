import { request, getToken } from './api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
  getLiveProgress: (id) =>
    request(`/admin/whatsapp-marketing/campaigns/${id}/live-progress`),
  pauseCampaign: (id) =>
    request(`/admin/whatsapp-marketing/campaigns/${id}/pause`, { method: 'POST' }),
  resumeCampaign: (id) =>
    request(`/admin/whatsapp-marketing/campaigns/${id}/resume`, { method: 'POST' }),
  stopCampaign: (id) =>
    request(`/admin/whatsapp-marketing/campaigns/${id}/stop`, { method: 'POST' }),
  syncDelivery: (id) =>
    request(`/admin/whatsapp-marketing/campaigns/${id}/sync-delivery`, { method: 'POST' }),
  retryFailed: (id, data = {}) =>
    request(`/admin/whatsapp-marketing/campaigns/${id}/retry-failed`, {
      method: 'POST',
      body: data,
    }),
  checkStatuses: (data) =>
    request('/admin/whatsapp-marketing/check-statuses', {
      method: 'POST',
      body: data,
    }),
  getStreamUrl: (id) => {
    const token = getToken();
    return `${BASE_URL}/api/v1/admin/whatsapp-marketing/campaigns/${id}/live-stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};
