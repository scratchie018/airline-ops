-- Multi-airline support: Role moves from a single global User.role to a per-
-- (User, Airline) Membership, and every operational table (RoleMapping,
-- AuditLog, Aircraft, Flight) becomes scoped to an Airline.
--
-- Data preservation: if this database already has User rows (an existing
-- single-tenant install), a single default Airline is created and every
-- existing user's old `role` becomes their Membership role in it, so no one
-- loses access. That airline's discordGuildId is left as a placeholder here
-- deliberately - the real guild ID lives only in server env vars, never in a
-- committed migration file. The server fills it in from env.discordGuildId on
-- its next boot (see src/index.ts), a one-time no-op after that.

-- CreateTable
CREATE TABLE "Airline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Airline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PASSENGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Airline_slug_key" ON "Airline"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Airline_discordGuildId_key" ON "Airline"("discordGuildId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_airlineId_key" ON "Membership"("userId", "airlineId");

-- CreateIndex
CREATE INDEX "Membership_airlineId_role_idx" ON "Membership"("airlineId", "role");

-- AddForeignKey
ALTER TABLE "Airline" ADD CONSTRAINT "Airline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add the new FK columns nullable for now, filled in by the backfill
-- block below (or by the app itself for airlines created after this migration).
ALTER TABLE "RoleMapping" ADD COLUMN "airlineId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "airlineId" TEXT;
ALTER TABLE "Aircraft" ADD COLUMN "airlineId" TEXT;
ALTER TABLE "Flight" ADD COLUMN "airlineId" TEXT;

-- Data backfill: one default Airline + a Membership per existing user, carrying
-- their old role forward. Placeholder discordGuildId, fixed up by the server on
-- boot (see comment above). No-op on a fresh database with no users yet.
DO $$
DECLARE
  default_airline_id TEXT;
  first_user_id TEXT;
BEGIN
  SELECT "id" INTO first_user_id FROM "User" ORDER BY "createdAt" ASC LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    default_airline_id := gen_random_uuid()::TEXT;

    INSERT INTO "Airline" ("id", "name", "slug", "discordGuildId", "createdById", "createdAt", "updatedAt")
    VALUES (default_airline_id, 'My Airline', 'my-airline', 'pending-setup-' || default_airline_id, first_user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    INSERT INTO "Membership" ("id", "userId", "airlineId", "role", "createdAt", "updatedAt")
    SELECT gen_random_uuid()::TEXT, "id", default_airline_id, "role", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM "User";

    -- RoleMapping/AuditLog/Aircraft/Flight can only have rows if a User already
    -- existed to create them, so this default airline covers every existing row.
    UPDATE "RoleMapping" SET "airlineId" = default_airline_id WHERE "airlineId" IS NULL;
    UPDATE "AuditLog" SET "airlineId" = default_airline_id WHERE "airlineId" IS NULL;
    UPDATE "Aircraft" SET "airlineId" = default_airline_id WHERE "airlineId" IS NULL;
    UPDATE "Flight" SET "airlineId" = default_airline_id WHERE "airlineId" IS NULL;
  END IF;
END $$;

-- DropIndex
DROP INDEX "User_role_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- AlterTable RoleMapping: enforce NOT NULL now that existing rows are backfilled
ALTER TABLE "RoleMapping" ALTER COLUMN "airlineId" SET NOT NULL;
DROP INDEX "RoleMapping_discordRoleId_key";
CREATE UNIQUE INDEX "RoleMapping_airlineId_discordRoleId_key" ON "RoleMapping"("airlineId", "discordRoleId");
ALTER TABLE "RoleMapping" ADD CONSTRAINT "RoleMapping_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable AuditLog
ALTER TABLE "AuditLog" ALTER COLUMN "airlineId" SET NOT NULL;
DROP INDEX "AuditLog_createdAt_idx";
CREATE INDEX "AuditLog_airlineId_createdAt_idx" ON "AuditLog"("airlineId", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Aircraft
ALTER TABLE "Aircraft" ALTER COLUMN "airlineId" SET NOT NULL;
DROP INDEX "Aircraft_tailNumber_key";
CREATE UNIQUE INDEX "Aircraft_airlineId_tailNumber_key" ON "Aircraft"("airlineId", "tailNumber");
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Flight
ALTER TABLE "Flight" ALTER COLUMN "airlineId" SET NOT NULL;
DROP INDEX "Flight_flightNumber_key";
DROP INDEX "Flight_status_idx";
CREATE UNIQUE INDEX "Flight_airlineId_flightNumber_key" ON "Flight"("airlineId", "flightNumber");
CREATE INDEX "Flight_airlineId_status_idx" ON "Flight"("airlineId", "status");
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
