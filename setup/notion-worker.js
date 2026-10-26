// Rawaq → Notion proxy. Deploy as a Cloudflare Worker (free tier). See SETUP.md, section 4.
// Secrets/variables to set in the Worker settings:
//   NOTION_TOKEN    (secret)   your Notion internal integration secret
//   ALLOWED_ORIGIN  (variable) the exact origin you open Rawaq from, e.g. https://yourname.github.io
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (!url.pathname.startsWith('/v1/') || !['GET', 'POST', 'PATCH'].includes(request.method)) {
      return new Response('Not found', { status: 404, headers: cors });
    }
    const upstream = await fetch('https://api.notion.com' + url.pathname + url.search, {
      method: request.method,
      headers: {
        Authorization: 'Bearer ' + env.NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: request.method === 'GET' ? undefined : await request.text(),
    });
    return new Response(upstream.body, { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
