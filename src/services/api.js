// ============================================
// API CLIENT
// - The access token (15 min) lives only in memory.
// - The refresh token is an httpOnly cookie the browser sends to /api/auth/*;
//   JavaScript never sees it. On a 401 we refresh once and retry.
// ============================================

let accessToken = null;
let refreshing = null;
let authLostHandler = null;

export const setAccessToken = (token) => { accessToken = token; };
export const onAuthLost = (fn) => { authLostHandler = fn; };

// Concurrent callers (e.g. React StrictMode's double effect) share one refresh,
// because the server rotates the refresh token on every use.
export const refreshAccess = () => {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = await res.json();
        accessToken = body.accessToken;
        return body;
      })
      .catch(() => null)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
};

const parse = async (res) => {
  try { return await res.json(); } catch { return {}; }
};

const networkError = { ok: false, status: 0, data: { error: 'Cannot reach the server. Is it running?' } };

export const request = async (method, path, body, { retry = true } = {}) => {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    return networkError;
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const renewed = await refreshAccess();
    if (renewed) return request(method, path, body, { retry: false });
    accessToken = null;
    authLostHandler?.();
  }
  return { ok: res.ok, status: res.status, data: await parse(res) };
};

// Downloads a file that needs the Authorization header (so a plain link cannot work)
export const downloadBlob = async (path) => {
  const attempt = async (allowRefresh) => {
    let res;
    try { res = await fetch(`/api${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, credentials: 'same-origin' }); } catch { return { ok: false, error: networkError.data.error }; }
    if (res.status === 401 && allowRefresh && (await refreshAccess())) return attempt(false);
    if (!res.ok) return { ok: false, error: (await parse(res)).error || 'Download failed.' };
    const disposition = res.headers.get('content-disposition') || '';
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] || 'download';
    return { ok: true, blob: await res.blob(), name };
  };
  return attempt(true);
};

export const saveBlob = ({ blob, name }) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// multipart upload with real byte progress (fetch can't report upload progress)
export const uploadForm = (path, formData, onProgress) => {
  const attempt = (allowRefresh) => new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onerror = () => resolve(networkError);
    xhr.onload = async () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* empty body */ }
      if (xhr.status === 401 && allowRefresh) {
        const renewed = await refreshAccess();
        if (renewed) return resolve(attempt(false));
        authLostHandler?.();
      }
      return resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.send(formData);
  });
  return attempt(true);
};

// Helpers for service functions
export const toResult = (r) => (r.ok ? { success: true, ...r.data } : { success: false, error: r.data?.error || 'Request failed.', fields: r.data?.fields });
