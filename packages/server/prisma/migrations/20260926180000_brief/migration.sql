-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "squawk" TEXT NOT NULL DEFAULT '',
    "flightLevel" TEXT NOT NULL DEFAULT '',
    "initialClimb" TEXT NOT NULL DEFAULT '',
    "departureIcao" TEXT NOT NULL DEFAULT '',
    "arrivalIcao" TEXT NOT NULL DEFAULT '',
    "waypoints" TEXT NOT NULL DEFAULT '',
    "departureRunway" TEXT NOT NULL DEFAULT '',
    "departureTaxiInfo" TEXT NOT NULL DEFAULT '',
    "arrivalRunway" TEXT NOT NULL DEFAULT '',
    "arrivalTaxiInfo" TEXT NOT NULL DEFAULT '',
    "atis" TEXT NOT NULL DEFAULT '',
    "notam" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brief_userId_airlineId_key" ON "Brief"("userId", "airlineId");

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
