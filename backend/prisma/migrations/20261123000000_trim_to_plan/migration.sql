-- Remove social, sharing and push features that are outside the thesis plan.
DROP TABLE IF EXISTS "CommentLike";
DROP TABLE IF EXISTS "Comment";
DROP TABLE IF EXISTS "ProductLike";
DROP TABLE IF EXISTS "Follow";
DROP TABLE IF EXISTS "SavedSearch";
DROP TABLE IF EXISTS "PushSubscription";
ALTER TABLE "User" DROP COLUMN IF EXISTS "shareToken";
ALTER TABLE "User" DROP COLUMN IF EXISTS "wishlistPublic";
