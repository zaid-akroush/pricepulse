// One-off local script to reset a user's password directly in the database.
// Usage:  node reset-password.js <email> <newPassword>
// Run this from inside the backend/ folder so it picks up your local .env
// (DATABASE_URL) automatically.

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [, , email, newPassword] = process.argv;

  if (!email || !newPassword) {
    console.error('Usage: node reset-password.js <email> <newPassword>');
    process.exit(1);
  }
  if (newPassword.length < 10) {
    console.error('Password must be at least 10 characters (same rule the app enforces).');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: {
      password: hashed,
      resetToken: null,
      resetTokenExpiry: null,
      tokenVersion: { increment: 1 }, // invalidate any old JWTs, same as the real reset flow
    },
  });

  console.log(`Password updated for ${email}. You can log in with the new password now.`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
