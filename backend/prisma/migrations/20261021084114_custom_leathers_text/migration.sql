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
    "customisationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customLeathers" TEXT NOT NULL DEFAULT 'Full Grain Leather, Pebbled Leather, Croco Embossed Leather, Saffiano Leather, Vegetable Tanned Leather, Nubuck Leather',
    "customisationNote" TEXT NOT NULL DEFAULT 'Made to order in your chosen leather — ships in 7–10 days.',
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
INSERT INTO "new_Settings" ("address", "announcementBar", "codEnabled", "codFee", "codMaxOpen", "codMaxOrder", "codMaxRefusals", "currency", "customLeathers", "customisationEnabled", "customisationNote", "defaultGstRate", "defaultHsnCode", "flatShippingFee", "freeShippingThreshold", "giftWrapFee", "gstin", "id", "instagramHandle", "legalName", "razorpayKeyId", "require2FA", "returnWindowDays", "shippingCostPerOrder", "state", "storeName", "supportEmail", "supportPhone", "tagline") SELECT "address", "announcementBar", "codEnabled", "codFee", "codMaxOpen", "codMaxOrder", "codMaxRefusals", "currency", "customLeathers", "customisationEnabled", "customisationNote", "defaultGstRate", "defaultHsnCode", "flatShippingFee", "freeShippingThreshold", "giftWrapFee", "gstin", "id", "instagramHandle", "legalName", "razorpayKeyId", "require2FA", "returnWindowDays", "shippingCostPerOrder", "state", "storeName", "supportEmail", "supportPhone", "tagline" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
