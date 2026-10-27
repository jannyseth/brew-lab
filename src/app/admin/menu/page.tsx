import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { AreaTitle } from "@/components/area-shell";
import { ImageUpload } from "@/components/image-upload";
import { cardClass } from "@/components/ui";
import { DEFAULT_PHOTO_CREDITS, menuPhotoUrl } from "@/lib/menu-photos";
import { requireRole } from "@/lib/session";
import { ResetPhotoButton } from "./reset-photo-button";

export const metadata: Metadata = { title: "Menu photos" };

export default async function MenuPhotosPage() {
  await requireRole(["super_admin"], "/admin/menu");
  const items = await db.select().from(menuItems).orderBy(asc(menuItems.sortOrder));

  return (
    <div>
      <AreaTitle
        title="Menu photos"
        subtitle="The photo customers see for each drink, in every branch. Uploads are cropped square and given the same warm look as the rest of the menu."
      />
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className={cardClass}>
            <p className="mb-3 font-semibold">{item.name}</p>
            <ImageUpload
              target={{ kind: "menu", slug: item.slug }}
              currentUrl={menuPhotoUrl(item.slug, item.imageKey)}
              label={item.imageKey ? "Your photo" : "Starter photo"}
              hint={item.imageKey ? "Uploaded by you." : `Free-licensed photo by ${DEFAULT_PHOTO_CREDITS[item.slug]?.author ?? "—"}.`}
              shape="square"
            />
            {item.imageKey && <ResetPhotoButton slug={item.slug} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
