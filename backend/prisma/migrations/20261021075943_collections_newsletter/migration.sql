-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "cardImage" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'footer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategory" TEXT,
    "material" TEXT,
    "price" REAL NOT NULL,
    "originalPrice" REAL,
    "discount" REAL NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "costPrice" REAL,
    "hsnCode" TEXT,
    "gstRate" REAL,
    "badge" TEXT,
    "colors" JSONB NOT NULL,
    "images" JSONB NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "features" JSONB NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishAt" DATETIME,
    "metaTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "collectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("badge", "category", "categoryId", "colors", "costPrice", "createdAt", "description", "discount", "features", "gstRate", "hsnCode", "id", "images", "isActive", "isFeatured", "lowStockThreshold", "material", "metaDescription", "metaTitle", "name", "originalPrice", "price", "publishAt", "rating", "reviewCount", "sku", "slug", "stock", "subcategory") SELECT "badge", "category", "categoryId", "colors", "costPrice", "createdAt", "description", "discount", "features", "gstRate", "hsnCode", "id", "images", "isActive", "isFeatured", "lowStockThreshold", "material", "metaDescription", "metaTitle", "name", "originalPrice", "price", "publishAt", "rating", "reviewCount", "sku", "slug", "stock", "subcategory" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");
