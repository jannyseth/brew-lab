import { IMAGE_KEY_PATTERN } from "@/lib/images";
import { getObject } from "@/lib/r2";

// Serves profile and branch pictures from the private R2 bucket. Only our own
// key format is accepted, so nothing else in the bucket can be read.
export async function GET(_: Request, { params }: RouteContext<"/api/images/[...key]">) {
  const key = (await params).key.join("/");
  if (!IMAGE_KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });

  const object = await getObject(key).catch(() => null);
  if (!object?.body) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": "image/webp",
      // Keys are never reused, so the image at a URL never changes.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
