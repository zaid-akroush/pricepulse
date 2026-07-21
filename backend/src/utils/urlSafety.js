const dns = require('dns').promises;
const net = require('net');

// SSRF guard for user-supplied URLs (product page URLs, image URLs).
// Requires http(s) and rejects hostnames/IPs that point at loopback,
// private, link-local, or otherwise non-public network ranges. Checks the
// DNS-resolved address(es) too, not just the literal hostname string, so a
// public-looking hostname that resolves to an internal IP (DNS rebinding)
// is still rejected.

function isDisallowedHostname(hostname) {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0';
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return true; // malformed, be safe
  const [a, b] = parts;
  if (a === 127) return true;                        // 127.0.0.0/8 loopback
  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16
  if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local
  if (a === 0) return true;                            // "this" network
  if (a === 100 && b >= 64 && b <= 127) return true;    // 100.64.0.0/10 CGNAT
  return false;
}

function isPrivateIPv6(ip) {
  const norm = ip.toLowerCase();
  if (norm === '::1') return true; // loopback
  if (norm.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 address, validate the embedded IPv4.
    const v4 = norm.split(':').pop();
    if (net.isIPv4(v4)) return isPrivateIPv4(v4);
  }
  if (/^fe[89ab][0-9a-f]:/.test(norm)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(norm)) return true;  // fc00::/7 unique local
  return false;
}

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unrecognized format, fail closed
}

/**
 * Validate that a URL is safe to store and later fetch server-side.
 * Returns { valid: true } or { valid: false, reason }.
 */
async function validateExternalUrl(url) {
  if (!url || typeof url !== 'string') return { valid: false, reason: 'URL is required' };

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'URL must use http or https' };
  }

  const hostname = parsed.hostname;
  if (isDisallowedHostname(hostname)) {
    return { valid: false, reason: 'URL host is not allowed' };
  }

  // Literal IP in the URL, validate directly (no DNS lookup needed/possible).
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) return { valid: false, reason: 'URL host is not allowed' };
    return { valid: true };
  }

  // Resolve DNS and validate every returned address, this is what closes
  // the DNS-rebinding gap (public hostname that resolves to a private IP).
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length) return { valid: false, reason: 'Could not resolve host' };
    for (const rec of records) {
      if (isPrivateIP(rec.address)) return { valid: false, reason: 'URL host is not allowed' };
    }
  } catch {
    return { valid: false, reason: 'Could not resolve host' };
  }

  return { valid: true };
}

module.exports = { validateExternalUrl };
