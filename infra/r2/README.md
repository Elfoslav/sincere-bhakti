# R2 bucket configuration

Version-controlled CORS policies for the Cloudflare R2 buckets that back media
uploads. Uploads go **browser → server → R2** via `POST /api/upload`
(see `src/lib/services/upload.ts`), so CORS is no longer needed for uploads
— the server signs `PutObjectCommand` calls directly.

CORS is retained for backward compatibility in case old clients still use
presigned PUT, and for any future direct-browser uploads.

## Buckets

| Environment | Bucket                   | CORS file        |
| ----------- | ------------------------ | ---------------- |
| Local dev   | `sincere-bhakti-dev`     | `cors-dev.json`  |
| Production  | `sincere-bhakti-uploads` | `cors-prod.json` |

The bucket name per environment comes from the `R2_BUCKET` env var.

## Applying a policy

Using Wrangler (`npx wrangler login` first):

```bash
npx wrangler r2 bucket cors put sincere-bhakti-dev     --file infra/r2/cors-dev.json
npx wrangler r2 bucket cors put sincere-bhakti-uploads --file infra/r2/cors-prod.json
```

Verify:

```bash
npx wrangler r2 bucket cors list sincere-bhakti-dev
```

Or apply via the dashboard: **R2 → <bucket> → Settings → CORS Policy → Edit**,
then paste the matching file's contents.
