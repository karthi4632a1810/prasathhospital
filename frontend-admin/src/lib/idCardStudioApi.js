import { request } from './api';
import { downloadPostFile, openPostFileTab } from './download';

export const idCardStudioApi = {
  /** Fetch pre-seeded faculty list from "Faculty list for ID.xlsx" */
  getFacultySeed: () => request('/admin/id-cards/faculty-seed'),

  /** Download a single combined multi-page PDF containing all/selected badges */
  downloadBulkPdf: (
    items,
    { template = false, showQr = true, showBadgeNo = true } = {},
    filename = 'CIIM2026-COMBINED-ID-CARDS.pdf'
  ) =>
    downloadPostFile(
      '/admin/id-cards/bulk-pdf',
      { items, template, showQr, showBadgeNo },
      filename
    ),

  /** Download a ZIP archive containing individual PDF badges */
  downloadBulkZip: (
    items,
    { template = false, showQr = true, showBadgeNo = true } = {},
    filename = 'CIIM2026-ID-CARDS.zip'
  ) =>
    downloadPostFile(
      '/admin/id-cards/bulk-zip',
      { items, template, showQr, showBadgeNo },
      filename
    ),

  /** Download a single ID card PDF */
  downloadSinglePdf: (
    { name, role, code, badgeNo, template = false, showQr = true, showBadgeNo = true },
    filename
  ) =>
    downloadPostFile(
      '/admin/id-cards/single-pdf',
      { name, role, code, badgeNo, template, showQr, showBadgeNo },
      filename || `${code || 'ID'}-${name || 'BADGE'}.pdf`
    ),

  /** Open single ID card in browser tab for direct print preview (Ctrl+P) */
  openSinglePdfTab: ({ name, role, code, badgeNo, template = false, showQr = true, showBadgeNo = true }) =>
    openPostFileTab('/admin/id-cards/single-pdf', {
      name,
      role,
      code,
      badgeNo,
      template,
      showQr,
      showBadgeNo,
    }),

  /** Open multi-page PDF in browser tab for direct print preview (Ctrl+P) */
  openBulkPdfTab: (items, { template = false, showQr = true, showBadgeNo = true } = {}) =>
    openPostFileTab('/admin/id-cards/bulk-pdf', { items, template, showQr, showBadgeNo }),
};
