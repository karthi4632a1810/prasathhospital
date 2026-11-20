import { request } from './api';

export const marketingCampaignApi = {
  getRecipients: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/admin/marketing-campaigns/recipients${queryStr}`);
  },
  getSessions: () => request('/admin/marketing-campaigns/sessions'),
  sendCampaign: (data) =>
    request('/admin/marketing-campaigns/send', {
      method: 'POST',
      body: data,
    }),
  getCampaigns: () => request('/admin/marketing-campaigns'),
  getCampaign: (id) => request(`/admin/marketing-campaigns/${id}`),
  cancelCampaign: (id) =>
    request(`/admin/marketing-campaigns/${id}/cancel`, {
      method: 'POST',
    }),
};
