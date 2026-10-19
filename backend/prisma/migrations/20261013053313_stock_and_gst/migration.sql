-- AlterTable
ALTER TABLE "Product" ADD COLUMN "gstRate" REAL;
ALTER TABLE "Product" ADD COLUMN "hsnCode" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "subtotal" REAL NOT NULL,
    "shipping" REAL NOT NULL DEFAULT 0,
    "giftWrapFee" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "refundedAmount" REAL NOT NULL DEFAULT 0,
    "courier" TEXT,
    "trackingNumber" TEXT,
    "cancelReason" TEXT,
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "paymentId" TEXT,
    "razorpayOrderId" TEXT,
    "address" JSONB NOT NULL,
    "giftWrap" BOOLEAN NOT NULL DEFAULT false,
    "giftNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("address", "cancelReason", "courier", "createdAt", "customerEmail", "customerName", "giftNote", "giftWrap", "giftWrapFee", "id", "paymentId", "paymentStatus", "razorpayOrderId", "refundedAmount", "shipping", "status", "subtotal", "total", "trackingNumber", "updatedAt", "userId") SELECT "address", "cancelReason", "courier", "createdAt", "customerEmail", "customerName", "giftNote", "giftWrap", "giftWrapFee", "id", "paymentId", "paymentStatus", "razorpayOrderId", "refundedAmount", "shipping", "status", "subtotal", "total", "trackingNumber", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
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
    "legalName" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("address", "announcementBar", "currency", "freeShippingThreshold", "gstin", "id", "instagramHandle", "legalName", "razorpayKeyId", "storeName", "supportEmail", "supportPhone", "tagline") SELECT "address", "announcementBar", "currency", "freeShippingThreshold", "gstin", "id", "instagramHandle", "legalName", "razorpayKeyId", "storeName", "supportEmail", "supportPhone", "tagline" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
