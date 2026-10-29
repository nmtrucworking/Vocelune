export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy all /api/v1/* requests to the Render Backend API
    if (url.pathname.startsWith('/api/v1/')) {
      const targetBase = env.API_PROXY_TARGET || 'https://vocelune.onrender.com';
      const cleanTarget = targetBase.replace(/\/+$/, '');
      const backendUrl = new URL(url.pathname + url.search, cleanTarget);

      const headers = new Headers(request.headers);
      headers.set('host', new URL(cleanTarget).host);

      const init = {
        method: request.method,
        headers,
        redirect: 'manual'
      };

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
      }

      return fetch(new Request(backendUrl.toString(), init));
    }

    // Serve static assets from Next.js export
    return env.ASSETS.fetch(request);
  }
};
