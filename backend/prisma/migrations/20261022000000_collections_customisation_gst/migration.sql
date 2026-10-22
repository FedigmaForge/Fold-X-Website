-- AlterTable
ALTER TABLE `foldx_product` ADD COLUMN `allowCustomisation` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `collectionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `foldx_settings` ADD COLUMN `businessType` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `customLeathers` TEXT NOT NULL DEFAULT ('Full Grain Leather, Pebbled Leather, Croco Embossed Leather, Saffiano Leather, Vegetable Tanned Leather, Nubuck Leather'),
    ADD COLUMN `customisationEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `customisationNote` TEXT NOT NULL DEFAULT ('Made to order in your chosen leather — ships in 7–10 days.'),
    ADD COLUMN `tradeName` VARCHAR(191) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE `foldx_collection` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tagline` TEXT NOT NULL DEFAULT (''),
    `description` TEXT NOT NULL DEFAULT (''),
    `image` TEXT NOT NULL DEFAULT (''),
    `cardImage` TEXT NOT NULL DEFAULT (''),
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_newsletter_subscriber` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'footer',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `foldx_newsletter_subscriber_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `foldx_product` ADD CONSTRAINT `foldx_product_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `foldx_collection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

