-- Prisma's own migration-history table lives in the `public` schema too, so
-- Supabase's Security Advisor flags it the same way as the app tables in
-- 20260923150000_enable_row_level_security: it holds no user data (just
-- migration names/checksums/timestamps), but it is still reachable through
-- the PostgREST anon/authenticated roles unless RLS is on. No policies are
-- added, for the same reason as the app tables: only the database owner
-- role (which `prisma migrate deploy` itself runs as, and which bypasses
-- RLS) ever needs to touch it.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
