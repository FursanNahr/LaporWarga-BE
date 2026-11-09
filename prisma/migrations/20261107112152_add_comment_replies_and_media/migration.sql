-- AlterTable
ALTER TABLE `comment` ADD COLUMN `parentId` INTEGER NULL;

-- AlterTable
ALTER TABLE `commentphoto` ADD COLUMN `type` ENUM('IMAGE', 'VIDEO') NOT NULL DEFAULT 'IMAGE';

-- CreateIndex
CREATE INDEX `Comment_parentId_idx` ON `Comment`(`parentId`);

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
