import { getToken } from './api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/** Downloads an authenticated file (CSV, PDF, etc.), attaching the bearer token. */
export async function downloadFile(path, filename) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || 'Download failed.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads a CSV export. */
export async function downloadCsv(path, filename) {
  return downloadFile(path, filename);
}
