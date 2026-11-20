import { getToken } from './api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function normalizeApiPath(path) {
  if (!path) return '/api/v1';
  if (path.startsWith('/api/v1')) return path;
  if (path.startsWith('api/v1')) return `/${path}`;
  const leadingSlash = path.startsWith('/') ? '' : '/';
  return `/api/v1${leadingSlash}${path}`;
}

/** Downloads an authenticated file (CSV, PDF, etc.), attaching the bearer token. */
export async function downloadFile(path, filename) {
  const token = getToken();
  const cleanPath = normalizeApiPath(path);
  const targetUrl = `${BASE_URL}${cleanPath}`;

  const response = await fetch(targetUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || `Download failed (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();

  // Defer removal so browsers can finish queuing the file download
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Ignored if already cleaned up
    }
  }, 2000);
}

/** Downloads an authenticated file generated via POST request (e.g. bulk ID card PDF or ZIP). */
export async function downloadPostFile(path, body, filename) {
  const token = getToken();
  const cleanPath = normalizeApiPath(path);
  const targetUrl = `${BASE_URL}${cleanPath}`;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || `Download failed (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Ignored
    }
  }, 2000);
}

/** Opens an authenticated PDF in a new tab for direct viewing or printing. */
export async function openPostFileTab(path, body) {
  const token = getToken();
  const cleanPath = normalizeApiPath(path);
  const targetUrl = `${BASE_URL}${cleanPath}`;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error?.message || `Failed to open PDF (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/** Downloads a CSV export. */
export async function downloadCsv(path, filename) {
  return downloadFile(path, filename);
}
