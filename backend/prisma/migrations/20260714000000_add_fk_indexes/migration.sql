-- Add indexes on frequently-filtered foreign-key columns that were not already
-- covered by an existing composite unique index. Postgres does not create
-- indexes on FK columns automatically, so these queries were doing sequential
-- scans:
--   * Notification.userId    — polled on every navigation (unread count) + lists
--   * PriceHistory.productId — loaded on every product detail / wishlist row
--   * ProductLike.productId  — like counts (unique index is leftmost userId)
--   * Comment.productId      — comment lists per product
--   * Follow.followingId     — followers list (unique index is leftmost followerId)

-- CreateIndex
CREATE INDEX "PriceHistory_productId_idx" ON "PriceHistory"("productId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE INDEX "ProductLike_productId_idx" ON "ProductLike"("productId");

-- CreateIndex
CREATE INDEX "Comment_productId_idx" ON "Comment"("productId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
