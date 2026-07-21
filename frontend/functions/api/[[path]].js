// Cloudflare Pages Function: catches every request to /api/* on
// pricepulse-cw6.pages.dev and forwards it to whatever backend URL is
// currently configured (the BACKEND_URL environment variable/secret).
//
// Why this exists: the actual backend runs in Docker on a laptop and is
// exposed to the internet through a Cloudflare Tunnel. That tunnel's URL
// changes every time it's restarted. Without this proxy, every URL change
// would require editing the frontend's build-time env var and running a
// full `npm run build` + `wrangler pages deploy`.
//
// With this proxy, the frontend always calls its own origin (`/api/...`),
// and only this function needs to know the real backend URL. Updating
// BACKEND_URL is a single command (see README) and takes effect immediately,
// with no rebuild and no redeploy.

export async function onRequest(context) {
  const { request, env } = context;

  const backendUrl = env.BACKEND_URL;
  if (!backendUrl) {
    return new Response(
      JSON.stringify({ error: 'BACKEND_URL is not configured on the Pages project.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const incoming = new URL(request.url);
  const target = backendUrl.replace(/\/$/, '') + incoming.pathname + incoming.search;

  // Copy headers but drop Host: the outbound fetch must use the backend's
  // own host, and Cloudflare's runtime handles that automatically.
  const headers = new Headers(request.headers);
  headers.delete('host');

  // Prove to the backend that this request genuinely came through this
  // proxy (and therefore that 'cf-connecting-ip' below is trustworthy).
  // The backend's rate limiter only trusts cf-connecting-ip when this
  // secret matches; otherwise anyone hitting the backend's public
  // onrender.com URL directly could spoof cf-connecting-ip and get a
  // fresh rate-limit bucket on every request. INTERNAL_PROXY_SECRET is a
  // Cloudflare Pages environment variable/secret that must match the
  // same-named env var on the Render backend. headers.set() overwrites
  // any value a client tried to send for this header, so it can't be
  // spoofed from the browser side either.
  if (env.INTERNAL_PROXY_SECRET) {
    headers.set('x-internal-proxy-secret', env.INTERNAL_PROXY_SECRET);
  }

  const init = {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  };

  try {
    const response = await fetch(target, init);
    // Return the backend's response as-is (status, body, headers), except
    // for a couple of headers that must NOT be copied through: fetch()
    // already transparently decompresses the body, so forwarding the
    // original content-encoding/content-length would tell the browser to
    // decode an already-decoded body (or expect a byte count that no
    // longer matches), corrupting or emptying the response.
    const respHeaders = new Headers(response.headers);
    respHeaders.delete('content-encoding');
    respHeaders.delete('content-length');
    respHeaders.delete('transfer-encoding');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Could not reach backend. Is Docker + the tunnel running?', detail: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
