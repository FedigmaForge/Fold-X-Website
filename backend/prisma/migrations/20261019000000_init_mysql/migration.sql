-- CreateTable
CREATE TABLE `foldx_user` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'customer',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `twoFactorSecret` VARCHAR(191) NULL,
    `twoFactorPending` VARCHAR(191) NULL,
    `backupCodes` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `foldx_user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `actorRole` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `summary` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL DEFAULT '',
    `image` TEXT NOT NULL DEFAULT (''),
    `sub` JSON NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `material` VARCHAR(191) NULL,
    `price` DOUBLE NOT NULL,
    `originalPrice` DOUBLE NULL,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `rating` DOUBLE NOT NULL DEFAULT 0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `sku` VARCHAR(191) NULL,
    `lowStockThreshold` INTEGER NOT NULL DEFAULT 5,
    `costPrice` DOUBLE NULL,
    `hsnCode` VARCHAR(191) NULL,
    `gstRate` DOUBLE NULL,
    `badge` VARCHAR(191) NULL,
    `colors` JSON NOT NULL,
    `images` JSON NOT NULL,
    `description` TEXT NOT NULL DEFAULT (''),
    `features` JSON NOT NULL,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `publishAt` DATETIME(3) NULL,
    `metaTitle` TEXT NOT NULL DEFAULT (''),
    `metaDescription` TEXT NOT NULL DEFAULT (''),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `foldx_product_slug_key`(`slug`),
    UNIQUE INDEX `foldx_product_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_product_variant` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '',
    `size` VARCHAR(191) NOT NULL DEFAULT '',
    `sku` VARCHAR(191) NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `foldx_product_variant_sku_key`(`sku`),
    UNIQUE INDEX `foldx_product_variant_productId_color_size_key`(`productId`, `color`, `size`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_stock_movement` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `change` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `orderId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `foldx_stock_movement_productId_createdAt_idx`(`productId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_banner` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `link` TEXT NULL,
    `desktopImage` TEXT NOT NULL,
    `mobileImage` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_order` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NOT NULL,
    `subtotal` DOUBLE NOT NULL,
    `shipping` DOUBLE NOT NULL DEFAULT 0,
    `giftWrapFee` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'online',
    `codFee` DOUBLE NOT NULL DEFAULT 0,
    `codConfirmedAt` DATETIME(3) NULL,
    `codRefused` BOOLEAN NOT NULL DEFAULT false,
    `cartToken` VARCHAR(191) NULL,
    `discountCode` VARCHAR(191) NULL,
    `couponId` VARCHAR(191) NULL,
    `total` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `refundedAmount` DOUBLE NOT NULL DEFAULT 0,
    `courier` VARCHAR(191) NULL,
    `trackingNumber` VARCHAR(191) NULL,
    `cancelReason` TEXT NULL,
    `stockDeducted` BOOLEAN NOT NULL DEFAULT false,
    `paymentId` VARCHAR(191) NULL,
    `razorpayOrderId` VARCHAR(191) NULL,
    `address` JSON NOT NULL,
    `giftWrap` BOOLEAN NOT NULL DEFAULT false,
    `giftNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_order_event` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `actorName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_order_item` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `variantId` VARCHAR(191) NULL,
    `productSnapshot` JSON NOT NULL,
    `quantity` INTEGER NOT NULL,
    `variant` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_review` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `userName` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `body` TEXT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isApproved` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `storeName` VARCHAR(191) NOT NULL DEFAULT 'FoldX',
    `tagline` VARCHAR(191) NOT NULL DEFAULT 'Handcrafted Leather Goods',
    `announcementBar` TEXT NOT NULL DEFAULT (''),
    `freeShippingThreshold` DOUBLE NOT NULL DEFAULT 999,
    `supportEmail` VARCHAR(191) NOT NULL DEFAULT '',
    `supportPhone` VARCHAR(191) NOT NULL DEFAULT '',
    `address` TEXT NOT NULL DEFAULT (''),
    `instagramHandle` VARCHAR(191) NOT NULL DEFAULT '',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `razorpayKeyId` VARCHAR(191) NOT NULL DEFAULT '',
    `gstin` VARCHAR(191) NOT NULL DEFAULT '',
    `state` VARCHAR(191) NOT NULL DEFAULT '',
    `defaultHsnCode` VARCHAR(191) NOT NULL DEFAULT '4202',
    `defaultGstRate` DOUBLE NOT NULL DEFAULT 18,
    `flatShippingFee` DOUBLE NOT NULL DEFAULT 99,
    `giftWrapFee` DOUBLE NOT NULL DEFAULT 149,
    `returnWindowDays` INTEGER NOT NULL DEFAULT 10,
    `codEnabled` BOOLEAN NOT NULL DEFAULT true,
    `codFee` DOUBLE NOT NULL DEFAULT 49,
    `codMaxOrder` DOUBLE NOT NULL DEFAULT 15000,
    `codMaxRefusals` INTEGER NOT NULL DEFAULT 2,
    `codMaxOpen` INTEGER NOT NULL DEFAULT 2,
    `shippingCostPerOrder` DOUBLE NOT NULL DEFAULT 0,
    `require2FA` BOOLEAN NOT NULL DEFAULT false,
    `legalName` VARCHAR(191) NOT NULL DEFAULT '',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_site_content` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_page` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL DEFAULT (''),
    `metaDescription` TEXT NOT NULL DEFAULT (''),
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `showInFooter` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `foldx_page_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_contact_message` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'new',
    `internalNote` TEXT NOT NULL DEFAULT (''),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_return_request` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `items` JSON NOT NULL,
    `reason` TEXT NOT NULL,
    `details` TEXT NOT NULL DEFAULT (''),
    `status` VARCHAR(191) NOT NULL DEFAULT 'requested',
    `adminNote` TEXT NOT NULL DEFAULT (''),
    `restocked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_coupon` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT (''),
    `isAutomatic` BOOLEAN NOT NULL DEFAULT false,
    `type` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL DEFAULT 0,
    `maxDiscount` DOUBLE NULL,
    `minSubtotal` DOUBLE NOT NULL DEFAULT 0,
    `appliesTo` VARCHAR(191) NOT NULL DEFAULT 'all',
    `targetIds` JSON NOT NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `usageLimit` INTEGER NULL,
    `perCustomerLimit` INTEGER NULL,
    `firstOrderOnly` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `foldx_coupon_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_coupon_redemption` (
    `id` VARCHAR(191) NOT NULL,
    `couponId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `discount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `foldx_coupon_redemption_couponId_email_idx`(`couponId`, `email`),
    UNIQUE INDEX `foldx_coupon_redemption_couponId_orderId_key`(`couponId`, `orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_customer_profile` (
    `email` VARCHAR(191) NOT NULL,
    `notes` TEXT NOT NULL DEFAULT (''),
    `tags` JSON NOT NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `blockReason` TEXT NOT NULL DEFAULT (''),
    `codDisabled` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_payment_transaction` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `gatewayRef` VARCHAR(191) NULL,
    `settlementStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `settledAt` DATETIME(3) NULL,
    `settlementId` VARCHAR(191) NULL,
    `settlementUtr` VARCHAR(191) NULL,
    `fee` DOUBLE NULL,
    `tax` DOUBLE NULL,
    `notes` TEXT NOT NULL DEFAULT (''),
    `actorName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `foldx_payment_transaction_gatewayRef_idx`(`gatewayRef`),
    INDEX `foldx_payment_transaction_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_settlement_import` (
    `id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `rows` INTEGER NOT NULL,
    `matched` INTEGER NOT NULL,
    `unmatched` JSON NOT NULL,
    `actorName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_staff_login` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(191) NOT NULL DEFAULT '',
    `ip` VARCHAR(191) NOT NULL DEFAULT '',
    `userAgent` TEXT NOT NULL DEFAULT (''),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `foldx_staff_login_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `foldx_abandoned_cart` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `items` JSON NOT NULL,
    `subtotal` DOUBLE NOT NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remindedAt` DATETIME(3) NULL,
    `reminderCount` INTEGER NOT NULL DEFAULT 0,
    `recoveredAt` DATETIME(3) NULL,
    `orderId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `foldx_abandoned_cart_token_key`(`token`),
    INDEX `foldx_abandoned_cart_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `foldx_product_variant` ADD CONSTRAINT `foldx_product_variant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `foldx_product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_stock_movement` ADD CONSTRAINT `foldx_stock_movement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `foldx_product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_stock_movement` ADD CONSTRAINT `foldx_stock_movement_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `foldx_product_variant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_order` ADD CONSTRAINT `foldx_order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `foldx_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_order` ADD CONSTRAINT `foldx_order_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `foldx_coupon`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_order_event` ADD CONSTRAINT `foldx_order_event_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `foldx_order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_order_item` ADD CONSTRAINT `foldx_order_item_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `foldx_order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_order_item` ADD CONSTRAINT `foldx_order_item_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `foldx_product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_order_item` ADD CONSTRAINT `foldx_order_item_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `foldx_product_variant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_review` ADD CONSTRAINT `foldx_review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `foldx_product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_review` ADD CONSTRAINT `foldx_review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `foldx_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_return_request` ADD CONSTRAINT `foldx_return_request_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `foldx_order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_return_request` ADD CONSTRAINT `foldx_return_request_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `foldx_user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_coupon_redemption` ADD CONSTRAINT `foldx_coupon_redemption_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `foldx_coupon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_coupon_redemption` ADD CONSTRAINT `foldx_coupon_redemption_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `foldx_order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `foldx_payment_transaction` ADD CONSTRAINT `foldx_payment_transaction_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `foldx_order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

