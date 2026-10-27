import { IMAGE_KEY_PATTERN } from "@/lib/images";
import { getImage } from "@/lib/image-store";

// Serves profile and branch pictures from the database. Only our own key
// format is accepted.
export async function GET(_: Request, { params }: RouteContext<"/api/images/[...key]">) {
  const key = (await params).key.join("/");
  if (!IMAGE_KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });

  const image = await getImage(key);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      // Keys are never reused, so the image at a URL never changes.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
