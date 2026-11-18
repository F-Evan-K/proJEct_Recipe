CREATE TABLE `ForecastBacktest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sourceHash` CHAR(64) NOT NULL,
    `protocol` VARCHAR(40) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `menuCount` INTEGER NOT NULL,
    `startedById` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,
    `result` JSON NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leaseUntil` DATETIME(3) NULL,
    `leaseToken` CHAR(36) NULL,
    `error` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ForecastBacktest_sourceHash_key`(`sourceHash`),
    INDEX `ForecastBacktest_status_availableAt_idx`(`status`, `availableAt`),
    INDEX `ForecastBacktest_status_leaseUntil_idx`(`status`, `leaseUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
