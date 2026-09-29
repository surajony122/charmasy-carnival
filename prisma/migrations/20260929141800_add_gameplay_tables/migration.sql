-- CreateTable
CREATE TABLE IF NOT EXISTS "GamePlay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "prizeType" TEXT,
    "prizeValue" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GameSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "activeGameId" INTEGER NOT NULL DEFAULT 1
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GamePlay_orderId_key" ON "GamePlay"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GameSettings_shop_key" ON "GameSettings"("shop");
