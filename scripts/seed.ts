// Resets the menu tables and loads the sample menu. Prices are in centavos (₱1 = 100).
// Run with: npm run db:seed
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

config({ path: ".env.local" });
const db = drizzle(process.env.DATABASE_URL!, { schema });

type GroupSeed = {
  slug: string;
  name: string;
  selection: "single" | "multi";
  minSelected: number;
  maxSelected: number;
  requiresOptionSlug?: string;
  options: [slug: string, name: string, priceDeltaCents: number, maxQuantity?: number][];
};

const groups: GroupSeed[] = [
  {
    slug: "size", name: "Size", selection: "single", minSelected: 1, maxSelected: 1,
    options: [["small", "Small · 12 oz", 0], ["medium", "Medium · 16 oz", 2000], ["large", "Large · 20 oz", 4000]],
  },
  {
    slug: "temperature", name: "Temperature", selection: "single", minSelected: 1, maxSelected: 1,
    options: [["hot", "Hot", 0], ["iced", "Iced", 0]],
  },
  {
    slug: "ice", name: "Ice level", selection: "single", minSelected: 1, maxSelected: 1, requiresOptionSlug: "iced",
    options: [["light-ice", "Light ice", 0], ["regular-ice", "Regular ice", 0], ["extra-ice", "Extra ice", 0]],
  },
  {
    slug: "roast", name: "Espresso roast", selection: "single", minSelected: 1, maxSelected: 1,
    options: [["signature-roast", "Signature", 0], ["blonde-roast", "Blonde", 0], ["decaf-roast", "Decaf", 0]],
  },
  {
    slug: "shots", name: "Espresso shots", selection: "multi", minSelected: 0, maxSelected: 1,
    options: [["espresso-shot", "Espresso shot", 4000, 6]],
  },
  {
    slug: "milk", name: "Milk", selection: "single", minSelected: 1, maxSelected: 1,
    options: [
      ["whole-milk", "Whole milk", 0], ["skim-milk", "Skim milk", 0], ["oat-milk", "Oat milk", 3500],
      ["almond-milk", "Almond milk", 3500], ["soy-milk", "Soy milk", 3000], ["no-milk", "No milk", 0],
    ],
  },
  {
    slug: "syrups", name: "Syrups", selection: "multi", minSelected: 0, maxSelected: 4,
    options: [
      ["vanilla-syrup", "Vanilla", 1000, 6], ["caramel-syrup", "Caramel", 1000, 6],
      ["hazelnut-syrup", "Hazelnut", 1000, 6], ["mocha-sauce", "Mocha sauce", 1000, 6],
    ],
  },
  {
    slug: "sweeteners", name: "Sweeteners", selection: "multi", minSelected: 0, maxSelected: 3,
    options: [["sugar", "Sugar", 0, 4], ["brown-sugar", "Brown sugar", 0, 4], ["stevia", "Stevia", 0, 4]],
  },
  {
    slug: "toppings", name: "Toppings", selection: "multi", minSelected: 0, maxSelected: 4,
    options: [
      ["whipped-cream", "Whipped cream", 2000], ["cold-foam", "Cold foam", 4500],
      ["caramel-drizzle", "Caramel drizzle", 2000], ["cinnamon", "Cinnamon", 0],
    ],
  },
];

const categoriesSeed = [
  { slug: "espresso", name: "Espresso classics", sortOrder: 1 },
  { slug: "cold", name: "Cold brew", sortOrder: 2 },
  { slug: "custom", name: "Build your own", sortOrder: 3 },
];

const latteGroups = ["size", "temperature", "ice", "roast", "shots", "milk", "syrups", "sweeteners", "toppings"];
const coldGroups = ["size", "temperature", "ice", "milk", "syrups", "sweeteners", "toppings"];

type ItemSeed = {
  slug: string;
  name: string;
  description: string;
  category: string;
  basePriceCents: number;
  defaults: Record<string, number>;
  groups: string[];
  // Group slug -> allowed option slugs for this drink.
  allowed?: Record<string, string[]>;
  isCustom?: boolean;
};

const hotOnly = { temperature: ["hot"] };
const icedOnly = { temperature: ["iced"] };

const items: ItemSeed[] = [
  {
    slug: "espresso", name: "Espresso", category: "espresso", basePriceCents: 12000,
    description: "A rich double shot, pulled short and served straight.",
    defaults: { "signature-roast": 1, "espresso-shot": 2 },
    groups: ["roast", "shots", "sweeteners"],
  },
  {
    slug: "americano", name: "Americano", category: "espresso", basePriceCents: 14000,
    description: "Espresso topped with hot water for a smooth, bold cup.",
    defaults: { medium: 1, hot: 1, "signature-roast": 1, "espresso-shot": 2 },
    groups: ["size", "temperature", "ice", "roast", "shots", "syrups", "sweeteners"],
  },
  {
    slug: "latte", name: "Caffè Latte", category: "espresso", basePriceCents: 16500,
    description: "Espresso with steamed milk and a light layer of foam.",
    defaults: { medium: 1, hot: 1, "signature-roast": 1, "espresso-shot": 2, "whole-milk": 1 },
    groups: latteGroups,
  },
  {
    slug: "cappuccino", name: "Cappuccino", category: "espresso", basePriceCents: 16500,
    description: "Equal parts espresso, steamed milk and deep, airy foam.",
    defaults: { medium: 1, hot: 1, "signature-roast": 1, "espresso-shot": 2, "whole-milk": 1 },
    groups: latteGroups, allowed: hotOnly,
  },
  {
    slug: "flat-white", name: "Flat White", category: "espresso", basePriceCents: 17500,
    description: "Three ristretto shots with velvety microfoam.",
    defaults: { medium: 1, hot: 1, "signature-roast": 1, "espresso-shot": 3, "whole-milk": 1 },
    groups: latteGroups, allowed: hotOnly,
  },
  {
    slug: "caramel-macchiato", name: "Caramel Macchiato", category: "espresso", basePriceCents: 19000,
    description: "Vanilla, milk and espresso finished with a caramel drizzle.",
    defaults: {
      medium: 1, hot: 1, "signature-roast": 1, "espresso-shot": 2, "whole-milk": 1,
      "vanilla-syrup": 3, "caramel-drizzle": 1,
    },
    groups: latteGroups,
  },
  {
    slug: "mocha", name: "Caffè Mocha", category: "espresso", basePriceCents: 18500,
    description: "Espresso, mocha sauce and steamed milk under whipped cream.",
    defaults: {
      medium: 1, hot: 1, "signature-roast": 1, "espresso-shot": 2, "whole-milk": 1,
      "mocha-sauce": 3, "whipped-cream": 1,
    },
    groups: latteGroups,
  },
  {
    slug: "cold-brew", name: "Cold Brew", category: "cold", basePriceCents: 16000,
    description: "Steeped for 20 hours for a smooth, low-acid coffee.",
    defaults: { medium: 1, iced: 1, "regular-ice": 1, "no-milk": 1 },
    groups: coldGroups, allowed: icedOnly,
  },
  {
    slug: "vanilla-cream-cold-brew", name: "Vanilla Cream Cold Brew", category: "cold", basePriceCents: 18500,
    description: "Cold brew with vanilla, crowned with sweet cold foam.",
    defaults: { medium: 1, iced: 1, "regular-ice": 1, "no-milk": 1, "vanilla-syrup": 2, "cold-foam": 1 },
    groups: coldGroups, allowed: icedOnly,
  },
  {
    slug: "build-your-own", name: "Build Your Own", category: "custom", basePriceCents: 11000,
    description: "Start from a single shot and make it exactly how you like it.",
    defaults: { small: 1, hot: 1, "signature-roast": 1, "espresso-shot": 1, "no-milk": 1 },
    groups: latteGroups, isCustom: true,
  },
];

async function main() {
  await db.execute(sql`TRUNCATE menu_item_option_groups, options, option_groups, menu_items, categories RESTART IDENTITY CASCADE`);

  const groupIds = new Map<string, number>();
  for (const [i, g] of groups.entries()) {
    const [row] = await db
      .insert(schema.optionGroups)
      .values({
        slug: g.slug, name: g.name, selection: g.selection, minSelected: g.minSelected,
        maxSelected: g.maxSelected, requiresOptionSlug: g.requiresOptionSlug ?? null, sortOrder: i,
      })
      .returning({ id: schema.optionGroups.id });
    groupIds.set(g.slug, row.id);
    await db.insert(schema.options).values(
      g.options.map(([slug, name, priceDeltaCents, maxQuantity = 1], j) => ({
        slug, name, priceDeltaCents, maxQuantity, groupId: row.id, sortOrder: j,
      })),
    );
  }

  const categoryRows = await db.insert(schema.categories).values(categoriesSeed).returning();
  const categoryIds = new Map(categoryRows.map((c) => [c.slug, c.id]));

  for (const [i, item] of items.entries()) {
    const [row] = await db
      .insert(schema.menuItems)
      .values({
        slug: item.slug, name: item.name, description: item.description,
        categoryId: categoryIds.get(item.category)!, basePriceCents: item.basePriceCents,
        defaults: item.defaults, isCustom: item.isCustom ?? false, sortOrder: i,
      })
      .returning({ id: schema.menuItems.id });
    await db.insert(schema.menuItemOptionGroups).values(
      item.groups.map((g) => ({
        menuItemId: row.id, groupId: groupIds.get(g)!, allowedOptionSlugs: item.allowed?.[g] ?? null,
      })),
    );
  }

  console.log(`Seeded ${groups.length} option groups, ${categoriesSeed.length} categories, ${items.length} drinks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
