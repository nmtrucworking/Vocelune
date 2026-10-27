ALTER TABLE "UserSettings" ADD COLUMN "dictionaryProvider" TEXT NOT NULL DEFAULT 'free_dictionary';
ALTER TABLE "UserSettings" ADD COLUMN "dictionaryFallbackEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_dictionaryProvider_check" CHECK ("dictionaryProvider" IN ('free_dictionary', 'merriam_webster', 'oxford'));
CREATE INDEX "ProviderUsage_provider_occurredAt_idx" ON "ProviderUsage" (provider, "occurredAt");

CREATE TABLE "DictionaryQuota" (provider TEXT NOT NULL, day VARCHAR(10) NOT NULL, used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0), PRIMARY KEY (provider, day));
