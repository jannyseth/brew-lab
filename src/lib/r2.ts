import "server-only";
import { AwsClient } from "aws4fetch";

// Cloudflare R2 through its S3-compatible API. The bucket stays private: the
// server uploads with a bucket-scoped token, and images are served through
// our own /api/images route.

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;

export const r2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);

const client = r2Configured
  ? new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" })
  : null;

const objectUrl = (key: string) =>
  `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;

function requireClient() {
  if (!client) throw new Error("Cloudflare R2 isn't set up yet (R2_* environment variables are missing).");
  return client;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const res = await requireClient().fetch(objectUrl(key), {
    method: "PUT",
    body: new Uint8Array(body),
    headers: { "Content-Type": contentType, "Content-Length": String(body.byteLength) },
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`);
}

export async function getObject(key: string) {
  const res = await requireClient().fetch(objectUrl(key));
  return res.ok ? res : null;
}

export async function deleteObject(key: string) {
  try {
    await requireClient().fetch(objectUrl(key), { method: "DELETE" });
  } catch (err) {
    console.error("R2 delete failed", err);
  }
}
