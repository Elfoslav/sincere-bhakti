-- @@unique([email, type]) already covers email-only queries; standalone index is redundant.
DROP INDEX IF EXISTS "VerificationToken_email_idx";
