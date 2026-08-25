-- Separate the "target price hit" alert from the generic "price dropped"
-- alert, so a generic drop can no longer suppress a target hit.
ALTER TABLE "WishlistItem" ADD COLUMN "notifiedTargetAt" TIMESTAMP(3);
