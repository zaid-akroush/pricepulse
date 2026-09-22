-- Supabase's Security Advisor flags every table in the `public` schema that
-- does not have Row Level Security enabled, because Supabase exposes that
-- schema through its auto-generated PostgREST API (the anon/authenticated
-- roles) by default. This app never uses that API or Supabase Auth --
-- Prisma always connects directly as the database owner via DATABASE_URL /
-- DIRECT_URL (see schema.prisma), and table owners bypass RLS, so this
-- migration does not change any app behavior. It only blocks the
-- PostgREST anon/authenticated roles from reading or writing these tables,
-- which is what the advisory is warning about. No policies are added
-- because nothing other than the app's own database role should ever query
-- these tables directly.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WishlistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Follow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommentLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedSearch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
