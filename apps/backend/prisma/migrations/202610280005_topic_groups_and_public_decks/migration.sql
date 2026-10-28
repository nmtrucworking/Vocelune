ALTER TABLE "Deck" ADD COLUMN "topicGroup" VARCHAR(60) NOT NULL DEFAULT 'Chung';
ALTER TABLE "Deck" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deck" ADD COLUMN "forkCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Deck_userId_topicGroup_idx" ON "Deck"("userId", "topicGroup");
CREATE INDEX "Deck_isPublic_deletedAt_idx" ON "Deck"("isPublic", "deletedAt");
