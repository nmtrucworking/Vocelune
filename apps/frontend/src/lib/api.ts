'use client';
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
function csrfToken() {
  return document.cookie.split('; ').find(v => v.startsWith('vocelune_csrf=') || v.startsWith('__Host-vocelune_csrf=') || v.startsWith('__Secure-vocelune_csrf='))?.split('=').slice(1).join('=') || '';
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const form = options.body instanceof FormData;
  const response = await fetch(`/api/v1${path}`, { ...options, credentials: 'include', cache: 'no-store', headers: { ...(options.body && !form ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-Token': csrfToken(), ...options.headers } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error?.code || 'REQUEST_FAILED', data.error?.message || 'Không thể kết nối máy chủ.');
  }
  return response.json();
}
export const post = <T>(path: string, body: unknown = {}, headers?: Record<string, string>) => api<T>(path, { method: 'POST', body: JSON.stringify(body), headers });
export async function downloadApi(path: string, filename: string, body?: unknown) {
  const response = await fetch(`/api/v1${path}`, { method: body ? 'POST' : 'GET', credentials: 'include', headers: { 'X-CSRF-Token': csrfToken(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error('Không thể tải tệp từ máy chủ.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
