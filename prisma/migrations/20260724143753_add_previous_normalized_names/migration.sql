-- AlterTable
ALTER TABLE "ChannelTranslation" ADD COLUMN     "previousNormalizedNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
