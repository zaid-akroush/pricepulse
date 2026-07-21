// Determine whether an email belongs to an admin, based on the comma-separated
// ADMIN_EMAILS environment variable. Comparison is case-insensitive.
function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

module.exports = { isAdminEmail, getAdminEmails };
