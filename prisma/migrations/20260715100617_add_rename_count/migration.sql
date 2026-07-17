-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "renameCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "renameCount" INTEGER NOT NULL DEFAULT 0;
