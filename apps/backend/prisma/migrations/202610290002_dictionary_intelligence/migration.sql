ALTER TABLE "VocabItem" ADD COLUMN "lexicalMetadata" JSONB;

CREATE TABLE "DictionaryEntry" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "entryRef" TEXT NOT NULL,
  "lemma" VARCHAR(100) NOT NULL,
  "normalized" VARCHAR(100) NOT NULL,
  "partOfSpeech" TEXT NOT NULL,
  "datasetVersion" TEXT NOT NULL,
  "candidate" JSONB NOT NULL,
  "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DictionaryEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DictionaryEntry_provider_entryRef_key" ON "DictionaryEntry"("provider", "entryRef");
CREATE INDEX "DictionaryEntry_normalized_partOfSpeech_provider_idx" ON "DictionaryEntry"("normalized", "partOfSpeech", "provider");

CREATE TABLE "DictionaryProviderHealth" (
  "provider" TEXT NOT NULL,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "blockedUntil" TIMESTAMPTZ(3),
  "reason" TEXT,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "DictionaryProviderHealth_pkey" PRIMARY KEY ("provider")
);
