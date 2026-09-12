-- Adaptive price-check scheduling + per-product shopping market.
ALTER TABLE "Product" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'us';
ALTER TABLE "Product" ADD COLUMN "checkIntervalHours" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "Product" ADD COLUMN "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Spread existing products across the next 6 hours so the first hourly sweep
-- after deploying does not re-check every product at once.
UPDATE "Product" SET "nextCheckAt" = NOW() + (random() * interval '6 hours');

CREATE INDEX "Product_nextCheckAt_idx" ON "Product"("nextCheckAt");
