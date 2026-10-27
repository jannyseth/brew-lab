import { and, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import sharp from "sharp";
import { db } from "@/db";
import { branches, menuItems, user } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { imageUrl, keyFromUrl } from "@/lib/images";
import { deleteImage, putImage } from "@/lib/image-store";
import { getSession } from "@/lib/session";

const MAX_BYTES = 4 * 1024 * 1024;
const json = (body: object, status = 200) => Response.json(body, { status });

/**
 * Uploads a profile picture (target=avatar), a branch photo (target=branch&id=…)
 * or a menu photo (target=menu&slug=…, super admin only).
 * The file is decoded and re-encoded as WebP, which rejects anything that
 * isn't really an image and strips hidden metadata such as GPS location.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return json({ error: "Please sign in first." }, 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const target = form?.get("target");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose an image to upload." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Images must be 4 MB or smaller." }, 400);

  let branchId: number | null = null;
  let menuSlug: string | null = null;
  if (target === "menu") {
    // Menu photos are shared by every branch, so only the super admin may change them.
    menuSlug = String(form?.get("slug") ?? "");
    const [item] =
      session.user.role === "super_admin" && /^[a-z0-9-]{1,80}$/.test(menuSlug)
        ? await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.slug, menuSlug))
        : [];
    if (!item) return json({ error: "Only the admin can change menu photos." }, 403);
  } else if (target === "branch") {
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
    webp = await (menuSlug
      ? // Menu photos get the same square crop and warm house look as the starter photos.
        image
          .resize(900, 900, { fit: "cover", position: sharp.strategy.attention })
          .modulate({ brightness: 1.04, saturation: 1.1 })
          .linear(1.06, -6)
          .recomb([
            [1.05, 0.02, 0],
            [0, 1.0, 0],
            [0, 0.02, 0.93],
          ])
          .sharpen({ sigma: 0.8 })
          .webp({ quality: 80 })
      : branchId === null
        ? image.resize(256, 256, { fit: "cover" }).webp({ quality: 78 })
        : image.resize(960, 504, { fit: "cover" }).webp({ quality: 78 })
    ).toBuffer();
  } catch {
    return json({ error: "That file isn't a supported image. Use a JPG, PNG or WebP." }, 400);
  }

  const key = menuSlug
    ? `menu/${menuSlug}/${crypto.randomUUID()}.webp`
    : branchId === null
      ? `avatars/${session.user.id}/${crypto.randomUUID()}.webp`
      : `branches/${branchId}/${crypto.randomUUID()}.webp`;
  await putImage(key, webp, "image/webp");

  let oldKey: string | null;
  if (menuSlug) {
    const [old] = await db.select({ key: menuItems.imageKey }).from(menuItems).where(eq(menuItems.slug, menuSlug));
    oldKey = old?.key ?? null;
    await db.update(menuItems).set({ imageKey: key }).where(eq(menuItems.slug, menuSlug));
    // Show the new photo on the next visit.
    revalidateTag("menu", { expire: 0 });
  } else if (branchId === null) {
    oldKey = keyFromUrl(session.user.image);
    await db.update(user).set({ image: imageUrl(key) }).where(eq(user.id, session.user.id));
    revalidatePath("/", "layout");
  } else {
    const [old] = await db.select({ key: branches.imageKey }).from(branches).where(eq(branches.id, branchId));
    oldKey = old?.key ?? null;
    await db.update(branches).set({ imageKey: key }).where(eq(branches.id, branchId));
    revalidatePath("/branch", "layout");
  }
  if (oldKey) await deleteImage(oldKey);

  await logActivity({
    userId: session.user.id,
    userEmail: session.user.email,
    action: menuSlug ? "menu.photo" : branchId === null ? "profile.photo" : "branch.photo",
    targetType: menuSlug ? "menu_item" : branchId === null ? "user" : "branch",
    targetId: menuSlug ?? branchId ?? session.user.id,
  });
  return json({ url: imageUrl(key) });
}
