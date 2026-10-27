-- Defer config checks until all account-owned rows have cascaded away.
ALTER TABLE "Card" DROP CONSTRAINT "Card_schedulerConfigId_fkey";
ALTER TABLE "Card" ADD CONSTRAINT "Card_schedulerConfigId_fkey" FOREIGN KEY ("schedulerConfigId") REFERENCES "SchedulerConfig"(id) ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ReviewLog" DROP CONSTRAINT "ReviewLog_schedulerConfigId_fkey";
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_schedulerConfigId_fkey" FOREIGN KEY ("schedulerConfigId") REFERENCES "SchedulerConfig"(id) ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ReviewLog" DROP CONSTRAINT "ReviewLog_sessionId_fkey";
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"(id) ON DELETE CASCADE ON UPDATE CASCADE;
