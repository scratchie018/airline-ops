-- CreateTable
CREATE TABLE "DesktopAuthSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopAuthSession_pkey" PRIMARY KEY ("id")
);
