export const DEFAULT_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
export const DEFAULT_WORKSPACE_URL = process.env.NEXT_PUBLIC_WORKSPACE_URL || '';

export function isWorkspaceHost(hostname?: string): boolean {
  if (!hostname) {
    if (typeof window !== 'undefined') hostname = window.location.hostname;
    else return false;
  }
  const clean = hostname.toLowerCase();
  return clean.startsWith('workspace.') || clean.includes('workspace-');
}

export function getWorkspaceUrl(path = '/dashboard'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_WORKSPACE_URL) {
    return cleanPath;
  }
  if (typeof window !== 'undefined') {
    if (isWorkspaceHost(window.location.hostname) || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return cleanPath;
    }
  }
  const baseUrl = process.env.NEXT_PUBLIC_WORKSPACE_URL;
  return baseUrl ? `${baseUrl.replace(/\/+$/, '')}${cleanPath}` : cleanPath;
}

export function getMarketingUrl(path = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_SITE_URL) {
    return cleanPath;
  }
  if (typeof window !== 'undefined') {
    if (!isWorkspaceHost(window.location.hostname) || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return cleanPath;
    }
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return baseUrl ? `${baseUrl.replace(/\/+$/, '')}${cleanPath}` : cleanPath;
}
