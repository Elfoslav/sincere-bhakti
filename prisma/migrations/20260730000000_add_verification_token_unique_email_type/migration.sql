-- Clean up duplicate (email, type) rows — keep only the most recent per group.
DELETE FROM "VerificationToken"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "email", "type" ORDER BY "createdAt" DESC
    ) rn
    FROM "VerificationToken"
  ) sub
  WHERE sub.rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_email_type_key" ON "VerificationToken"("email", "type");
