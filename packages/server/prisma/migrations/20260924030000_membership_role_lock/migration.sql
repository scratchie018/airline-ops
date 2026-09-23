-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "roleLocked" BOOLEAN NOT NULL DEFAULT false;

-- Existing OWNER memberships were already implicitly protected from Discord
-- role sync by a hardcoded role === OWNER check - make that protection
-- explicit data instead, now that the check is roleLocked-driven so an Owner
-- can grant the same permanence to any other role from the Admin panel.
UPDATE "Membership" SET "roleLocked" = true WHERE "role" = 'OWNER';
