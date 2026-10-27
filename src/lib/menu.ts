import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { categories, menuItemOptionGroups, menuItems, optionGroups, options } from "@/db/schema";
import type { DrinkConfig } from "./drink";
import { menuPhotoUrl } from "./menu-photos";

// Menu reads are cached for hours and tagged "menu" so the admin screens
// (phase 3) can refresh them with updateTag("menu"). This keeps database
// usage, and therefore the free Neon quota, to a minimum.

export async function getMenu() {
  "use cache";
  cacheLife("hours");
  cacheTag("menu");

  const [cats, items] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(menuItems).where(eq(menuItems.active, true)).orderBy(asc(menuItems.sortOrder)),
  ]);
  return cats
    .map((c) => ({ ...c, items: items.filter((i) => i.categoryId === c.id) }))
    .filter((c) => c.items.length > 0);
}

export async function getDrinkSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag("menu");

  const rows = await db.select({ slug: menuItems.slug }).from(menuItems).where(eq(menuItems.active, true));
  return rows.map((r) => r.slug);
}

export async function getDrink(slug: string): Promise<DrinkConfig | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("menu");

  const [item] = await db.select().from(menuItems).where(eq(menuItems.slug, slug)).limit(1);
  if (!item || !item.active) return null;

  const links = await db.select().from(menuItemOptionGroups).where(eq(menuItemOptionGroups.menuItemId, item.id));
  const groupIds = links.map((l) => l.groupId);
  const photoUrl = menuPhotoUrl(item.slug, item.imageKey);
  if (groupIds.length === 0) return { ...item, photoUrl, groups: [] };

  const [groupRows, optionRows] = await Promise.all([
    db.select().from(optionGroups).where(inArray(optionGroups.id, groupIds)).orderBy(asc(optionGroups.sortOrder)),
    db.select().from(options).where(inArray(options.groupId, groupIds)).orderBy(asc(options.sortOrder)),
  ]);

  return {
    slug: item.slug,
    name: item.name,
    description: item.description,
    basePriceCents: item.basePriceCents,
    isCustom: item.isCustom,
    defaults: item.defaults,
    photoUrl,
    groups: groupRows.map((g) => {
      const allowed = links.find((l) => l.groupId === g.id)?.allowedOptionSlugs;
      return {
        slug: g.slug,
        name: g.name,
        selection: g.selection,
        minSelected: g.minSelected,
        maxSelected: g.maxSelected,
        requiresOptionSlug: g.requiresOptionSlug,
        options: optionRows
          .filter((o) => o.groupId === g.id && o.active && (!allowed || allowed.includes(o.slug)))
          .map(({ slug, name, priceDeltaCents, maxQuantity }) => ({ slug, name, priceDeltaCents, maxQuantity })),
      };
    }),
  };
}
