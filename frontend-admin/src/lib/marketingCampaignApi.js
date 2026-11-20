import { request } from './api';

export const marketingCampaignApi = {
  getRecipients: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/admin/marketing-campaigns/recipients${queryStr}`);
  },
  getSessions: () => request('/admin/marketing-campaigns/sessions'),
  getLiveMonitor: () => request('/admin/marketing-campaigns/live-monitor'),

  scheduleAllSessions: (data) =>
    request('/admin/marketing-campaigns/schedule-all-sessions', {
      method: 'POST',
      body: data,
    }),

  launchScheduledNow: (id) =>
    request(`/admin/marketing-campaigns/campaigns/${id}/launch-now`, {
      method: 'POST',
    }),

  pauseCampaign: (id) =>
    request(`/admin/marketing-campaigns/campaigns/${id}/pause`, {
      method: 'POST',
    }),

  resumeCampaign: (id) =>
    request(`/admin/marketing-campaigns/campaigns/${id}/resume`, {
      method: 'POST',
    }),

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
