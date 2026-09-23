-- CreateEnum
CREATE TYPE "DrinkOrderStatus" AS ENUM ('PENDING', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DrinkOrder" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "status" "DrinkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrinkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrinkOrder_flightId_status_idx" ON "DrinkOrder"("flightId", "status");

-- CreateIndex
CREATE INDEX "DrinkOrder_userId_idx" ON "DrinkOrder"("userId");

-- AddForeignKey
ALTER TABLE "DrinkOrder" ADD CONSTRAINT "DrinkOrder_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrinkOrder" ADD CONSTRAINT "DrinkOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
