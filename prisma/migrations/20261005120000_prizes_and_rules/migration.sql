-- GamePlay additions
ALTER TABLE "GamePlay" ADD COLUMN "phone" TEXT;
ALTER TABLE "GamePlay" ADD COLUMN "outcomeWin" BOOLEAN;
ALTER TABLE "GamePlay" ADD COLUMN "prizeId" TEXT;
ALTER TABLE "GamePlay" ADD COLUMN "prizeLabel" TEXT;
ALTER TABLE "GamePlay" ADD COLUMN "prizeKind" TEXT;
ALTER TABLE "GamePlay" ADD COLUMN "rolledAt" DATETIME;
ALTER TABLE "GamePlay" ADD COLUMN "finishedAt" DATETIME;
ALTER TABLE "GamePlay" ADD COLUMN "delivery" TEXT;
ALTER TABLE "GamePlay" ADD COLUMN "deliveryNote" TEXT;

-- GameSettings additions
ALTER TABLE "GameSettings" ADD COLUMN "manualActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GameSettings" ADD COLUMN "couponDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "GameSettings" ADD COLUMN "requireOrder" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GameConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "winChance" INTEGER NOT NULL DEFAULT 50,
    "dailyLimit" INTEGER NOT NULL DEFAULT 6
);
CREATE UNIQUE INDEX "GameConfig_shop_gameId_key" ON "GameConfig"("shop", "gameId");

-- CreateTable
CREATE TABLE "PrizeConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER,
    "productId" TEXT,
    "variantId" TEXT,
    "productTitle" TEXT,
    "imageUrl" TEXT,
    "share" INTEGER NOT NULL DEFAULT 1,
    "dailyLimit" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX "PrizeConfig_shop_gameId_idx" ON "PrizeConfig"("shop", "gameId");
