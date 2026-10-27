ALTER TABLE "TestQuestion" ADD COLUMN "answerVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_answerVersion_check" CHECK ("answerVersion" >= 0);
