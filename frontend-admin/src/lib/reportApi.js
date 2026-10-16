import { request } from './api';
import { downloadCsv } from './download';
import { toQuery } from './registrationApi';

export const reportApi = {
  overview: (eventId) => request(`/admin/reports/overview?event=${encodeURIComponent(eventId)}`),
  breakdown: (params) => request(`/admin/reports/breakdown?${toQuery(params)}`),
  exportRegistrations: (params) =>
    downloadCsv(`/admin/reports/export/registrations.csv?${toQuery(params)}`, 'registrations.csv'),
  exportCompanies: (params) =>
    downloadCsv(`/admin/reports/export/companies.csv?${toQuery(params)}`, 'companies.csv'),
  exportCoupons: (params) =>
    downloadCsv(`/admin/reports/export/coupons.csv?${toQuery(params)}`, 'coupons.csv'),
};
