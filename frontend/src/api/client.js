import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../auth/tokenStore.js';

const BASE_URL = '/api/v1';

async function rawRequest(path, options) {
  const accessToken = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

async function rawUploadRequest(path, formData, method) {
  const accessToken = getAccessToken();
  const headers = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${BASE_URL}${path}`, { method, headers, body: formData });
}

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) {
    return false;
  }

  const { tokens } = await response.json();
  setTokens(tokens);
  return true;
}

export async function apiRequest(path, options = {}) {
  let response = await rawRequest(path, options);

  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await rawRequest(path, options);
    }
  }

  if (response.status === 401) {
    clearTokens();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`);
  }
  return body;
}

export async function apiDownload(path) {
  let response = await rawRequest(path, { method: 'GET' });

  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await rawRequest(path, { method: 'GET' });
    }
  }

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'download';
  const blob = await response.blob();
  return { blob, filename };
}

export async function apiUpload(path, formData, method = 'POST') {
  let response = await rawUploadRequest(path, formData, method);

  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await rawUploadRequest(path, formData, method);
    }
  }

  if (response.status === 401) {
    clearTokens();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Upload failed with status ${response.status}`);
  }
  return body;
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: (path) => apiRequest(path, { method: 'GET' }),
  post: (path, data) => apiRequest(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => apiRequest(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => apiRequest(path, { method: 'DELETE' })
};
