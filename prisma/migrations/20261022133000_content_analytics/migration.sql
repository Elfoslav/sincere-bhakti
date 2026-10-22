CREATE TABLE "AnalyticsDaily" (
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "metric" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("resourceType", "resourceId", "day", "metric")
);
CREATE INDEX "AnalyticsDaily_resourceType_resourceId_metric_idx" ON "AnalyticsDaily"("resourceType", "resourceId", "metric");
CREATE TABLE "AnalyticsReceipt" (
  "key" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "AnalyticsReceipt_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AnalyticsReceipt_expiresAt_idx" ON "AnalyticsReceipt"("expiresAt");
