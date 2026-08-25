// Turns a raw failure into an operator-readable diagnosis.
//
// When something on the site doesn't load, an end user should see a short,
// calm message — but whoever runs the site needs to know *which* thing broke
// and what to do about it. Stack traces only ever reach the server log, so
// in practice an admin had to SSH in to find out that the search provider was
// simply out of credits. This maps a thrown error to a named cause, a plain
// description, and the concrete steps that fix it, so an admin sees the
// diagnosis in the UI where the failure happened.
//
// Nothing here is ever sent to a non-admin: routes attach `diagnostic` only
// when the requester is an admin (see middleware/attachDiagnostics).

const DIAGNOSES = [
  {
    code: 'SEARCH_PROVIDER_UNCONFIGURED',
    match: (err) => /not configured|missing api key/i.test(err.message || ''),
    title: 'Product search is not configured',
    detail: 'The server started without a search-provider API key, so no live product data can be fetched.',
    steps: [
      'Set SERP_API_KEY in the backend environment (.env locally, or the service\'s environment variables in production).',
      'Restart the backend so the new value is read at boot.',
      'Confirm with GET /api/health/diagnostics that the key is now detected.',
    ],
  },
  {
    code: 'SEARCH_PROVIDER_REJECTED',
    match: (err) => err.status === 401 || err.status === 403,
    title: 'The search provider rejected our API key',
    detail: 'The provider returned 401/403. That is either an invalid key or an account with no remaining credits — it will not fix itself on retry.',
    steps: [
      'Check the key in the provider dashboard is still active and matches SERP_API_KEY.',
      'Check the account\'s remaining credit balance — an exhausted plan also returns 403.',
      'Rotate the key if it was leaked or revoked, then redeploy the backend.',
    ],
  },
  {
    code: 'SEARCH_PROVIDER_OUT_OF_CREDITS',
    match: (err) => err.status === 402,
    title: 'The search provider is out of credits',
    detail: 'The provider returned 402 Payment Required. Live pricing stays unavailable until the plan is topped up; cached prices are still served.',
    steps: [
      'Top up or upgrade the plan in the search provider\'s dashboard.',
      'Consider raising the cache TTLs in routes/products.js if quota runs out regularly.',
    ],
  },
  {
    code: 'SEARCH_PROVIDER_RATE_LIMITED',
    match: (err) => err.status === 429,
    title: 'The search provider is rate limiting us',
    detail: 'Too many requests in a short window (429). This is usually temporary and recovers on its own.',
    steps: [
      'Wait a few minutes and retry — no config change is needed for a one-off spike.',
      'If it is constant, raise the cache TTLs or lower the price-refresh cron frequency.',
    ],
  },
  {
    code: 'DATABASE_UNREACHABLE',
    match: (err) => /P1001|Can't reach database|ECONNREFUSED.*5432|database server/i.test(err.message || ''),
    title: 'The database is unreachable',
    detail: 'Prisma could not open a connection. Nothing that reads or writes data will work until this is resolved.',
    steps: [
      'Check the database service is running (docker compose ps, or the provider\'s dashboard).',
      'Verify DATABASE_URL — host, port, credentials and the sslmode the provider requires.',
      'Check the database allows connections from this server\'s IP.',
    ],
  },
  {
    code: 'DATABASE_SCHEMA_OUT_OF_DATE',
    match: (err) => /P2021|P2022|does not exist in the current database|column .* does not exist/i.test(err.message || ''),
    title: 'The database schema is out of date',
    detail: 'A table or column the code expects is missing, which means a migration has not been applied to this database.',
    steps: [
      'Run `npx prisma migrate deploy` against this environment.',
      'Run `npx prisma generate` and redeploy if the Prisma client is also stale.',
      'Confirm the deploy pipeline runs migrations before starting the server.',
    ],
  },
  {
    code: 'UPSTREAM_TIMEOUT',
    match: (err) => /ETIMEDOUT|ECONNABORTED|timeout of \d+ms/i.test(err.message || ''),
    title: 'An upstream request timed out',
    detail: 'A retailer page or the search provider did not respond in time. Usually transient, but a persistent timeout points at network egress.',
    steps: [
      'Retry — a single slow retailer page is normal and is handled gracefully.',
      'If every upstream call times out, check the server\'s outbound network access and any egress firewall rules.',
    ],
  },
  {
    code: 'DNS_FAILURE',
    match: (err) => /ENOTFOUND|EAI_AGAIN/i.test(err.message || ''),
    title: 'DNS lookup failed',
    detail: 'The server could not resolve a hostname, so outbound requests cannot be made.',
    steps: [
      'Check the container/host DNS configuration.',
      'Confirm outbound network access is permitted from this environment.',
    ],
  },
];

const FALLBACK = {
  code: 'UNEXPECTED_ERROR',
  title: 'Unexpected server error',
  detail: 'This failure does not match a known cause, so it needs the server log to diagnose.',
  steps: [
    'Open the backend logs and find the stack trace for this request.',
    'Reproduce with the same request to confirm it is deterministic.',
    'If it turns out to be a recurring cause, add it to services/diagnostics.js so it is explained automatically next time.',
  ],
};

/**
 * Diagnose a thrown error.
 * @param {Error & {status?: number}} err
 * @param {object} [context] free-form extra info shown to the admin (route, id…)
 */
function diagnose(err, context = {}) {
  const found = DIAGNOSES.find(d => {
    try { return d.match(err); } catch { return false; }
  }) || FALLBACK;

  return {
    code: found.code,
    title: found.title,
    detail: found.detail,
    steps: found.steps,
    // The raw message is useful to an admin and is only ever included in
    // admin-visible responses.
    raw: err?.message || String(err),
    context,
  };
}

/**
 * Environment self-check used by the admin diagnostics panel — reports what is
 * configured without ever revealing a secret's value.
 */
function environmentReport() {
  const check = (name, ok, fix) => ({ name, ok, fix: ok ? null : fix });
  return [
    check('DATABASE_URL', Boolean(process.env.DATABASE_URL),
      'Set DATABASE_URL to the Postgres connection string and restart the backend.'),
    check('JWT_SECRET', Boolean(process.env.JWT_SECRET),
      'Set JWT_SECRET to a long random string. Without it, login cannot issue tokens.'),
    check('SERP_API_KEY (product search)', Boolean(process.env.SERP_API_KEY),
      'Set SERP_API_KEY to enable live product search and price refreshes.'),
    check('SMTP / mailer', Boolean(process.env.SMTP_HOST || process.env.SMTP_URL),
      'Set the SMTP variables to enable price-drop emails. In-app notifications work without it.'),
    check('VAPID push keys', Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      'Generate a VAPID keypair (npx web-push generate-vapid-keys) to enable browser push notifications.'),
  ];
}

module.exports = { diagnose, environmentReport, DIAGNOSES };
