# Image storage: Cloudflare R2 (or any S3-compatible bucket)

Attar stores admin-uploaded product images with one of two adapters:

| `STORAGE_ADAPTER` | Where images go | Use it on |
|---|---|---|
| `local` (default) | `.data/uploads` on the server, served at `/uploads/<file>` | your computer, [Docker](docker.md), any server with a disk |
| `s3` | an S3-compatible bucket | Vercel and other serverless hosts, which have no writable disk |

Uploads are checked (JPEG, PNG or WebP only, under 5 MB, and the bytes must
match the claimed type), resized to at most 1600 px, and saved as WebP. The
demo images live in `public/seed` and never need a bucket.

## Cloudflare R2

R2 has a free tier of 10 GB of storage with no charge for downloads.
Cloudflare asks for a payment method before it enables R2, even if you stay
within the free tier. If you'd rather not add a card, use
[Supabase Storage](#other-providers) instead.

1. In the Cloudflare dashboard, open **R2 Object Storage** and create a bucket,
   for example `attar-uploads`.
2. Open the bucket's **Settings → Public access** and enable the **r2.dev
   subdomain**, or connect your own domain. Copy the public URL, for example
   `https://pub-1234abcd.r2.dev`.
3. Back in R2, open **Manage API tokens → Create API token**. Give it
   **Object Read & Write** on that bucket only. Copy the **Access Key ID** and
   **Secret Access Key**. The secret is shown once.
4. Your S3 endpoint is `https://<account-id>.r2.cloudflarestorage.com`. The
   account ID is on the R2 overview page.
5. Set these environment variables (in Vercel: Settings → Environment
   Variables), then redeploy:

   ```bash
   STORAGE_ADAPTER=s3
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=attar-uploads
   S3_ACCESS_KEY_ID=<access key id>
   S3_SECRET_ACCESS_KEY=<secret access key>
   S3_PUBLIC_URL=https://pub-1234abcd.r2.dev
   ```

6. Test it: in **Admin → Products**, open a product and add an image from
   your device. The image should appear in the editor and, after you save, on
   the product page.

If a required variable is missing, pages show an error and the server log
names the variable. If a variable is set but wrong (a bad key, for example), the upload shows
*"Upload failed … check storage settings"*, and **Admin → Settings** shows
which adapter is active.

## Other providers

The `s3` adapter sends standard AWS Signature V4 requests with path-style
URLs (`<endpoint>/<bucket>/<file>`). Before release we ran it against an
S3-compatible server that enforces SigV4 (upload, public read, delete, and
rejection of a wrong secret). We haven't run it against each provider below
with a real account, so if one misbehaves, please open an issue:

| Provider | `S3_ENDPOINT` | `S3_PUBLIC_URL` |
|---|---|---|
| Supabase Storage (free, no card; create a **public** bucket and S3 access keys under Storage → Settings) | `https://<project-ref>.supabase.co/storage/v1/s3` | `https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>` |
| AWS S3 | `https://s3.<region>.amazonaws.com` | your bucket's public URL or CloudFront domain |
| MinIO (self-hosted) | your MinIO URL | your MinIO public bucket URL |

Set `S3_REGION` to the provider's region name (Supabase shows it in the
connection details). R2 uses `auto`.
