import { request } from './api';

export const couponApi = {
  list: (params = {}) => request(`/admin/coupons?${new URLSearchParams(params).toString()}`),
  create: (body) => request('/admin/coupons', { method: 'POST', body }),
  createSeries: (body) => request('/admin/coupons/series', { method: 'POST', body }),
  createTestBatch: (body = {}) => request('/admin/coupons/test-batch', { method: 'POST', body }),
  purgeTestBatch: (params = {}) =>
    request(`/admin/coupons/test-batch?${new URLSearchParams(params).toString()}`, { method: 'DELETE' }),
  update: (id, body) => request(`/admin/coupons/${id}`, { method: 'PATCH', body }),
  remove: (id, params = {}) =>
    request(`/admin/coupons/${id}?${new URLSearchParams(params).toString()}`, { method: 'DELETE' }),
  generateCode: (companyId) =>
    request(`/admin/coupons/generate-code?company=${encodeURIComponent(companyId)}`),
};
