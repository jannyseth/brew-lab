import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { db } from "@/db";
import { branches, user } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { imageUrl, keyFromUrl } from "@/lib/images";
import { deleteObject, putObject, r2Configured } from "@/lib/r2";
import { getSession } from "@/lib/session";

const MAX_BYTES = 4 * 1024 * 1024;
const json = (body: object, status = 200) => Response.json(body, { status });

/**
 * Uploads a profile picture (target=avatar) or a branch photo (target=branch&id=…).
 * The file is decoded and re-encoded as WebP, which rejects anything that
 * isn't really an image and strips hidden metadata such as GPS location.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return json({ error: "Please sign in first." }, 401);
  if (!r2Configured) return json({ error: "Picture uploads aren't set up yet. Please try again later." }, 503);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const target = form?.get("target");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose an image to upload." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Images must be 4 MB or smaller." }, 400);

  let branchId: number | null = null;
  if (target === "branch") {
    branchId = Number(form?.get("id"));
    // Only the branch's own verified owner may change its photo.
    const [branch] =
      session.user.role === "branch_manager" && Number.isInteger(branchId)
        ? await db
            .select({ id: branches.id })
            .from(branches)
            .where(and(eq(branches.id, branchId), eq(branches.managerId, session.user.id)))
        : [];
    if (!branch) return json({ error: "You can't change this branch's photo." }, 403);
  } else if (target !== "avatar") {
    return json({ error: "Unknown upload." }, 400);
  }

  let webp: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate();
    webp = await (branchId === null
      ? image.resize(256, 256, { fit: "cover" })
      : image.resize(1200, 630, { fit: "cover" })
    )
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return json({ error: "That file isn't a supported image. Use a JPG, PNG or WebP." }, 400);
  }

  const key = branchId === null ? `avatars/${session.user.id}/${crypto.randomUUID()}.webp` : `branches/${branchId}/${crypto.randomUUID()}.webp`;
  await putObject(key, webp, "image/webp");

  let oldKey: string | null;
  if (branchId === null) {
    oldKey = keyFromUrl(session.user.image);
    await db.update(user).set({ image: imageUrl(key) }).where(eq(user.id, session.user.id));
    revalidatePath("/", "layout");
  } else {
    const [old] = await db.select({ key: branches.imageKey }).from(branches).where(eq(branches.id, branchId));
    oldKey = old?.key ?? null;
    await db.update(branches).set({ imageKey: key }).where(eq(branches.id, branchId));
    revalidatePath("/branch", "layout");
  }
  if (oldKey) await deleteObject(oldKey);

  await logActivity({
    userId: session.user.id,
    userEmail: session.user.email,
    action: branchId === null ? "profile.photo" : "branch.photo",
    targetType: branchId === null ? "user" : "branch",
    targetId: branchId ?? session.user.id,
  });
  return json({ url: imageUrl(key) });
}
