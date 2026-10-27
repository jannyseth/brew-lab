import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";

// Pictures live in the Neon database next to everything else, so there is no
// separate storage service to set up or pay for.

export async function putImage(key: string, body: Buffer, contentType: string) {
  await db.insert(images).values({ key, contentType, data: body.toString("base64"), sizeBytes: body.byteLength });
}

export async function getImage(key: string) {
  const [row] = await db.select().from(images).where(eq(images.key, key));
  return row ? { contentType: row.contentType, body: Buffer.from(row.data, "base64") } : null;
}

export async function deleteImage(key: string) {
  await db.delete(images).where(eq(images.key, key));
}
