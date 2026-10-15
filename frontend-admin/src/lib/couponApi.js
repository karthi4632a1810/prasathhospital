import { request } from './api';

export const couponApi = {
  list: (params = {}) => request(`/admin/coupons?${new URLSearchParams(params).toString()}`),
  create: (body) => request('/admin/coupons', { method: 'POST', body }),
  update: (id, body) => request(`/admin/coupons/${id}`, { method: 'PATCH', body }),
  remove: (id) => request(`/admin/coupons/${id}`, { method: 'DELETE' }),
  generateCode: (companyId) => request(`/admin/coupons/generate-code?company=${encodeURIComponent(companyId)}`),
};
