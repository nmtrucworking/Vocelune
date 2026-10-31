-- Admin console: account suspension + audit indexes
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMPTZ(3);
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- The editorial author account previously used a published password and the admin role.
-- Demote it and make the password unusable so it can no longer sign in.
UPDATE "User" SET "role" = 'editorial', "passwordHash" = 'scrypt:disabled:disabled'
WHERE "email" = 'editorial@vocelune.com';
DELETE FROM "AuthSession" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'editorial@vocelune.com');
CREATE INDEX "AuditLog_action_resourceId_occurredAt_idx" ON "AuditLog"("action", "resourceId", "occurredAt");
