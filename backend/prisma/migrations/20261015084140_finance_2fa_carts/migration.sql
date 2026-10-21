-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cartToken" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "costPrice" REAL;

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "gatewayRef" TEXT,
    "settlementStatus" TEXT NOT NULL DEFAULT 'pending',
    "settledAt" DATETIME,
    "settlementId" TEXT,
    "settlementUtr" TEXT,
    "fee" REAL,
    "tax" REAL,
    "notes" TEXT NOT NULL DEFAULT '',
    "actorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettlementImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "matched" INTEGER NOT NULL,
    "unmatched" JSONB NOT NULL,
    "actorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StaffLogin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AbandonedCart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "subtotal" REAL NOT NULL,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remindedAt" DATETIME,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "recoveredAt" DATETIME,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "storeName" TEXT NOT NULL DEFAULT 'FoldX',
    "tagline" TEXT NOT NULL DEFAULT 'Handcrafted Leather Goods',
    "announcementBar" TEXT NOT NULL DEFAULT '',
    "freeShippingThreshold" REAL NOT NULL DEFAULT 999,
    "supportEmail" TEXT NOT NULL DEFAULT '',
    "supportPhone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "instagramHandle" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "razorpayKeyId" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "defaultHsnCode" TEXT NOT NULL DEFAULT '4202',
    "defaultGstRate" REAL NOT NULL DEFAULT 18,
    "flatShippingFee" REAL NOT NULL DEFAULT 99,
    "giftWrapFee" REAL NOT NULL DEFAULT 149,
    "returnWindowDays" INTEGER NOT NULL DEFAULT 10,
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codFee" REAL NOT NULL DEFAULT 49,
    "codMaxOrder" REAL NOT NULL DEFAULT 15000,
    "codMaxRefusals" INTEGER NOT NULL DEFAULT 2,
    "codMaxOpen" INTEGER NOT NULL DEFAULT 2,
    "shippingCostPerOrder" REAL NOT NULL DEFAULT 0,
    "require2FA" BOOLEAN NOT NULL DEFAULT false,
    "legalName" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("address", "announcementBar", "codEnabled", "codFee", "codMaxOpen", "codMaxOrder", "codMaxRefusals", "currency", "defaultGstRate", "defaultHsnCode", "flatShippingFee", "freeShippingThreshold", "giftWrapFee", "gstin", "id", "instagramHandle", "legalName", "razorpayKeyId", "returnWindowDays", "state", "storeName", "supportEmail", "supportPhone", "tagline") SELECT "address", "announcementBar", "codEnabled", "codFee", "codMaxOpen", "codMaxOrder", "codMaxRefusals", "currency", "defaultGstRate", "defaultHsnCode", "flatShippingFee", "freeShippingThreshold", "giftWrapFee", "gstin", "id", "instagramHandle", "legalName", "razorpayKeyId", "returnWindowDays", "state", "storeName", "supportEmail", "supportPhone", "tagline" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "role" TEXT NOT NULL DEFAULT 'customer',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorPending" TEXT,
    "backupCodes" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("city", "createdAt", "email", "id", "isActive", "name", "passwordHash", "phone", "role") SELECT "city", "createdAt", "email", "id", "isActive", "name", "passwordHash", "phone", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PaymentTransaction_gatewayRef_idx" ON "PaymentTransaction"("gatewayRef");

-- CreateIndex
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "StaffLogin_userId_createdAt_idx" ON "StaffLogin"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCart_token_key" ON "AbandonedCart"("token");

-- CreateIndex
CREATE INDEX "AbandonedCart_email_idx" ON "AbandonedCart"("email");
