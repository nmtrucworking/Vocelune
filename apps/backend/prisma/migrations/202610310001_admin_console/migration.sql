-- Admin console: account suspension + audit indexes
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMPTZ(3);
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- Allow 'editorial' role in User table
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_role_check";
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK (role IN ('learner', 'admin', 'editorial'));

-- The editorial author account previously used a published password and the admin role.
-- Demote it and make the password unusable so it can no longer sign in.
UPDATE "User" SET "role" = 'editorial', "passwordHash" = 'scrypt:disabled:disabled'
WHERE "email" = 'editorial@vocelune.com';
DELETE FROM "AuthSession" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'editorial@vocelune.com');
CREATE INDEX IF NOT EXISTS "AuditLog_action_resourceId_occurredAt_idx" ON "AuditLog"("action", "resourceId", "occurredAt");
