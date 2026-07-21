-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wishlistPublic" BOOLEAN NOT NULL DEFAULT true;
