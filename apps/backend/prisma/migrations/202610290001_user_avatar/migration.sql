-- Add avatarAssetId to User table
ALTER TABLE "User" ADD COLUMN "avatarAssetId" UUID;

-- CreateIndex
CREATE INDEX "User_avatarAssetId_idx" ON "User"("avatarAssetId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarAssetId_fkey" FOREIGN KEY ("avatarAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
