-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'learner',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "englishDialect" TEXT NOT NULL DEFAULT 'en-us',
    "desiredRetention" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "newCardsPerDay" INTEGER NOT NULL DEFAULT 20,
    "dayStartHour" INTEGER NOT NULL DEFAULT 4,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPronounce" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerConfig" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'FSRS-6',
    "libraryVersion" TEXT NOT NULL DEFAULT '5.4.2',
    "parameters" JSONB NOT NULL,
    "retention" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lexeme" (
    "id" UUID NOT NULL,
    "lemma" VARCHAR(100) NOT NULL,
    "normalized" VARCHAR(100) NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "partOfSpeech" TEXT NOT NULL,

    CONSTRAINT "Lexeme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lexemeId" UUID NOT NULL,
    "senseKey" TEXT NOT NULL,
    "word" VARCHAR(100) NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "meaningVi" TEXT NOT NULL,
    "definitionEn" TEXT NOT NULL DEFAULT '',
    "exampleEn" TEXT NOT NULL DEFAULT '',
    "exampleVi" TEXT NOT NULL DEFAULT '',
    "phonetic" TEXT NOT NULL DEFAULT '',
    "dialect" TEXT NOT NULL DEFAULT 'en-us',
    "cefr" TEXT NOT NULL DEFAULT 'unknown',
    "cefrSource" TEXT NOT NULL DEFAULT 'manual',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "sourceKind" TEXT NOT NULL DEFAULT 'user',
    "provenance" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "VocabItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#4F46E5',
    "icon" TEXT NOT NULL DEFAULT 'book',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckItem" (
    "deckId" UUID NOT NULL,
    "vocabItemId" UUID NOT NULL,
    "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckItem_pkey" PRIMARY KEY ("deckId","vocabItemId")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vocabItemId" UUID NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'en_vi',
    "state" TEXT NOT NULL DEFAULT 'new',
    "dueAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMPTZ(3),
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elapsedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scheduledDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "buriedUntil" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "schedulerConfigId" UUID NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'flashcard',
    "kind" TEXT NOT NULL DEFAULT 'srs',
    "settingsSnapshot" JSONB NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reveal" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "cardVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Reveal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "sessionId" UUID,
    "clientRequestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'srs_study',
    "beforeState" TEXT NOT NULL,
    "afterState" TEXT NOT NULL,
    "beforeSnapshot" JSONB NOT NULL,
    "afterSnapshot" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "schedulerConfigId" UUID NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyAttempt" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "vocabItemId" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestDefinition" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "blueprint" JSONB NOT NULL,
    "scoringVersion" TEXT NOT NULL DEFAULT 'exact-nfc-v1',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "definitionId" UUID NOT NULL,
    "seed" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL,

    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestQuestion" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "vocabId" UUID NOT NULL,
    "cardId" UUID,
    "snapshot" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "userAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMPTZ(3),
    "srsAppliedAt" TIMESTAMPTZ(3),

    CONSTRAINT "TestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "deckId" UUID NOT NULL,
    "policy" TEXT NOT NULL DEFAULT 'skip',
    "rows" JSONB NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabMedia" (
    "vocabItemId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,

    CONSTRAINT "VocabMedia_pkey" PRIMARY KEY ("vocabItemId","mediaId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderUsage" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "status" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulerConfig_userId_version_key" ON "SchedulerConfig"("userId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Lexeme_normalized_partOfSpeech_language_key" ON "Lexeme"("normalized", "partOfSpeech", "language");

-- CreateIndex
CREATE INDEX "VocabItem_userId_createdAt_id_idx" ON "VocabItem"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "VocabItem_userId_lexemeId_senseKey_idx" ON "VocabItem"("userId", "lexemeId", "senseKey");

-- CreateIndex
CREATE INDEX "VocabItem_tags_idx" ON "VocabItem" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "Deck_userId_createdAt_idx" ON "Deck"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DeckItem_vocabItemId_idx" ON "DeckItem"("vocabItemId");

-- CreateIndex
CREATE INDEX "Card_userId_dueAt_idx" ON "Card"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Card_vocabItemId_template_key" ON "Card"("vocabItemId", "template");

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Reveal_sessionId_cardId_idx" ON "Reveal"("sessionId", "cardId");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ReviewLog_cardId_reviewedAt_idx" ON "ReviewLog"("cardId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewLog_userId_clientRequestId_key" ON "ReviewLog"("userId", "clientRequestId");

-- CreateIndex
CREATE INDEX "TestAttempt_userId_startedAt_idx" ON "TestAttempt"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestQuestion_attemptId_ordinal_key" ON "TestQuestion"("attemptId", "ordinal");

-- CreateIndex
CREATE INDEX "ImportJob_userId_createdAt_idx" ON "ImportJob"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportJob_userId_idempotencyKey_key" ON "ImportJob"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");

-- CreateIndex
CREATE INDEX "MediaAsset_userId_status_idx" ON "MediaAsset"("userId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProviderUsage_occurredAt_idx" ON "ProviderUsage"("occurredAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_createdAt_idx" ON "EmailOutbox"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulerConfig" ADD CONSTRAINT "SchedulerConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabItem" ADD CONSTRAINT "VocabItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabItem" ADD CONSTRAINT "VocabItem_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "Lexeme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckItem" ADD CONSTRAINT "DeckItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckItem" ADD CONSTRAINT "DeckItem_vocabItemId_fkey" FOREIGN KEY ("vocabItemId") REFERENCES "VocabItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_vocabItemId_fkey" FOREIGN KEY ("vocabItemId") REFERENCES "VocabItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_schedulerConfigId_fkey" FOREIGN KEY ("schedulerConfigId") REFERENCES "SchedulerConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reveal" ADD CONSTRAINT "Reveal_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reveal" ADD CONSTRAINT "Reveal_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_schedulerConfigId_fkey" FOREIGN KEY ("schedulerConfigId") REFERENCES "SchedulerConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyAttempt" ADD CONSTRAINT "StudyAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestDefinition" ADD CONSTRAINT "TestDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "TestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabMedia" ADD CONSTRAINT "VocabMedia_vocabItemId_fkey" FOREIGN KEY ("vocabItemId") REFERENCES "VocabItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabMedia" ADD CONSTRAINT "VocabMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Domain invariants not expressible in Prisma schema.
CREATE UNIQUE INDEX "Deck_active_name_key" ON "Deck" ("userId", "normalizedName") WHERE "deletedAt" IS NULL;
CREATE INDEX "Card_active_due_idx" ON "Card" ("userId", "dueAt") WHERE "deletedAt" IS NULL AND NOT suspended;
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK (role IN ('learner','admin'));
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_limits" CHECK ("desiredRetention" BETWEEN 0.85 AND 0.95 AND "newCardsPerDay" BETWEEN 0 AND 1000 AND "dayStartHour" BETWEEN 0 AND 23);
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_dialect" CHECK ("englishDialect" IN ('en-us','en-gb'));
ALTER TABLE "Card" ADD CONSTRAINT "Card_state_check" CHECK (state IN ('new','learning','review','relearning'));
ALTER TABLE "Card" ADD CONSTRAINT "Card_template_check" CHECK (template IN ('en_vi','vi_en','audio_word','definition_en'));
ALTER TABLE "Card" ADD CONSTRAINT "Card_values_check" CHECK (version >= 1 AND reps >= 0 AND lapses >= 0 AND stability >= 0 AND difficulty >= 0 AND "learningSteps" >= 0);
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_rating_check" CHECK (rating BETWEEN 1 AND 4 AND "durationMs" BETWEEN 0 AND 120000);
ALTER TABLE "VocabItem" ADD CONSTRAINT "VocabItem_cefr_check" CHECK (cefr IN ('A1','A2','B1','B2','C1','C2','unknown'));
ALTER TABLE "VocabItem" ADD CONSTRAINT "VocabItem_content_check" CHECK (length(trim(word)) > 0 AND length(trim("meaningVi")) > 0);
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_score_check" CHECK (score BETWEEN 0 AND "maxScore" AND "deadlineAt" >= "startedAt");

CREATE FUNCTION check_resource_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'DeckItem' THEN
    IF (SELECT "userId" FROM "Deck" WHERE id = NEW."deckId") IS DISTINCT FROM (SELECT "userId" FROM "VocabItem" WHERE id = NEW."vocabItemId") THEN RAISE EXCEPTION 'cross_owner_reference'; END IF;
  ELSIF TG_TABLE_NAME = 'Card' THEN
    IF NEW."userId" IS DISTINCT FROM (SELECT "userId" FROM "VocabItem" WHERE id = NEW."vocabItemId") OR NEW."userId" IS DISTINCT FROM (SELECT "userId" FROM "SchedulerConfig" WHERE id = NEW."schedulerConfigId") THEN RAISE EXCEPTION 'cross_owner_reference'; END IF;
  ELSIF TG_TABLE_NAME = 'ReviewLog' THEN
    IF NEW."userId" IS DISTINCT FROM (SELECT "userId" FROM "Card" WHERE id = NEW."cardId") OR NEW."userId" IS DISTINCT FROM (SELECT "userId" FROM "SchedulerConfig" WHERE id = NEW."schedulerConfigId") THEN RAISE EXCEPTION 'cross_owner_reference'; END IF;
    IF NEW."sessionId" IS NOT NULL AND NEW."userId" IS DISTINCT FROM (SELECT "userId" FROM "StudySession" WHERE id = NEW."sessionId") THEN RAISE EXCEPTION 'cross_owner_reference'; END IF;
  ELSIF TG_TABLE_NAME = 'VocabMedia' THEN
    IF (SELECT "userId" FROM "MediaAsset" WHERE id = NEW."mediaId") IS DISTINCT FROM (SELECT "userId" FROM "VocabItem" WHERE id = NEW."vocabItemId") THEN RAISE EXCEPTION 'cross_owner_reference'; END IF;
  ELSIF TG_TABLE_NAME = 'TestAttempt' THEN
    IF NEW."userId" IS DISTINCT FROM (SELECT "userId" FROM "TestDefinition" WHERE id = NEW."definitionId") THEN RAISE EXCEPTION 'cross_owner_reference'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER deck_item_owner BEFORE INSERT OR UPDATE ON "DeckItem" FOR EACH ROW EXECUTE FUNCTION check_resource_owner();
CREATE TRIGGER card_owner BEFORE INSERT OR UPDATE ON "Card" FOR EACH ROW EXECUTE FUNCTION check_resource_owner();
CREATE TRIGGER review_owner BEFORE INSERT OR UPDATE ON "ReviewLog" FOR EACH ROW EXECUTE FUNCTION check_resource_owner();
CREATE TRIGGER vocab_media_owner BEFORE INSERT OR UPDATE ON "VocabMedia" FOR EACH ROW EXECUTE FUNCTION check_resource_owner();
CREATE TRIGGER test_attempt_owner BEFORE INSERT OR UPDATE ON "TestAttempt" FOR EACH ROW EXECUTE FUNCTION check_resource_owner();
CREATE FUNCTION protect_review_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'voidedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'voidedAt') THEN RAISE EXCEPTION 'review_events_are_immutable'; END IF;
  IF OLD."voidedAt" IS NOT NULL AND NEW."voidedAt" IS DISTINCT FROM OLD."voidedAt" THEN RAISE EXCEPTION 'voided_review_is_immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER review_immutable BEFORE UPDATE ON "ReviewLog" FOR EACH ROW EXECUTE FUNCTION protect_review_event();
CREATE FUNCTION protect_scheduler_config() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'scheduler_configs_are_immutable'; END $$;
CREATE TRIGGER scheduler_immutable BEFORE UPDATE ON "SchedulerConfig" FOR EACH ROW EXECUTE FUNCTION protect_scheduler_config();
