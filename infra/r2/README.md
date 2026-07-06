# R2 bucket configuration

Version-controlled CORS policies for the Cloudflare R2 buckets that back media
uploads. Uploads go **browser → R2** via a presigned `PUT` (see
`src/lib/services/upload.ts`), so the R2 bucket must allow the cross-origin
`PUT` preflight or the browser blocks the upload.

## Buckets

| Environment | Bucket                   | Uploaded from            | CORS file        |
| ----------- | ------------------------ | ------------------------ | ---------------- |
| Local dev   | `sincere-bhakti-dev`     | `http://localhost:3000`  | `cors-dev.json`  |
| Production  | `sincere-bhakti-uploads` | `https://www.sincerebhakti.com` (+ Vercel previews) | `cors-prod.json` |

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

## Testing the preflight

```bash
curl -X OPTIONS "https://<account-id>.r2.cloudflarestorage.com/<bucket>/test.mp4" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: content-type" -i
```

A working policy returns `access-control-allow-origin` matching the `Origin`.

## Notes

- **Origins must match exactly**: scheme + host + port, no trailing slash, no path.
- `AllowedHeaders` must include `content-type` — the client PUT sets it, which
  is what triggers the preflight.
- Rendering media (`<img>`/`<video>` from the `pub-*.r2.dev` public URL) is not a
  CORS request, so `GET` is intentionally omitted here.
- `https://*.vercel.app` covers Vercel preview deployments (R2 allows a single
  `*` wildcard per origin). Remove it if uploads only happen from production.
- When migrating to multipart uploads, add `"ExposeHeaders": ["ETag"]` so the
  client can read each part's ETag to complete the upload.
