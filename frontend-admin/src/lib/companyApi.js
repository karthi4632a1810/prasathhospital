import { request } from './api';

export const companyApi = {
  list: (params = {}) => request(`/admin/companies?${new URLSearchParams(params).toString()}`),
  create: (body) => request('/admin/companies', { method: 'POST', body }),
  update: (id, body) => request(`/admin/companies/${id}`, { method: 'PATCH', body }),
  remove: (id) => request(`/admin/companies/${id}`, { method: 'DELETE' }),
};
