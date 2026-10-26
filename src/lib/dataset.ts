import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { optionGroups, options, orderItems, orders, user } from "@/db/schema";

// Drink-composition analytics for the admin Dataset tab. Everything here
// except customerPreferences() is anonymous: no names, emails or user IDs.
// Counts are of drinks (order item quantity) in non-cancelled orders.

/** Option groups that describe what's in the cup (not size, temperature or ice). */
const ADD_ON_GROUPS = ["roast", "shots", "milk", "syrups", "sweeteners", "toppings"];
const addOnGroups = sql.raw(ADD_ON_GROUPS.map((g) => `'${g}'`).join(","));

/** Every selected option of every drink sold, one row per (item, option). */
const usage = sql`
  select ${orderItems.id} as item_id, ${orderItems.drinkName} as drink, ${orderItems.quantity} as cups,
         ${orders.userId} as user_id, sel.key as slug, sel.value::int as amount
  from ${orderItems}
  join ${orders} on ${orders.id} = ${orderItems.orderId}
  cross join lateral jsonb_each_text(${orderItems.selection}) as sel
  where ${orders.status} <> 'cancelled'
`;

export type IngredientRow = { group_slug: string; group_name: string; slug: string; name: string; cups: number; units: number };

/** How often each option is chosen, including options never chosen. */
export async function ingredientPopularity() {
  const rows = await db.execute<IngredientRow>(sql`
    with usage as (${usage})
    select g.slug as group_slug, g.name as group_name, o.slug, o.name,
           coalesce(sum(u.cups), 0)::int as cups, coalesce(sum(u.cups * u.amount), 0)::int as units
    from ${options} o
    join ${optionGroups} g on g.id = o.group_id
    left join usage u on u.slug = o.slug
    group by g.slug, g.name, g.sort_order, o.slug, o.name
    order by g.sort_order, cups desc
  `);
  return rows.rows;
}

/** Pairs of add-ons most often chosen together in the same drink. */
export async function commonCombinations(limit = 10) {
  const rows = await db.execute<{ first: string; second: string; cups: number }>(sql`
    with usage as (${usage}),
    addons as (
      select u.item_id, u.cups, o.name
      from usage u join ${options} o on o.slug = u.slug join ${optionGroups} g on g.id = o.group_id
      where g.slug in (${addOnGroups}) and o.slug not in ('signature-roast', 'no-milk')
    )
    select a.name as first, b.name as second, sum(a.cups)::int as cups
    from addons a join addons b on a.item_id = b.item_id and a.name < b.name
    group by 1, 2
    order by 3 desc
    limit ${limit}
  `);
  return rows.rows;
}

/** The exact recipes (drink + all options) ordered most often. */
export async function popularRecipes(limit = 8) {
  const rows = await db.execute<{ drink: string; summary: string; cups: number }>(sql`
    select ${orderItems.drinkName} as drink, min(${orderItems.summary}) as summary, sum(${orderItems.quantity})::int as cups
    from ${orderItems} join ${orders} on ${orders.id} = ${orderItems.orderId}
    where ${orders.status} <> 'cancelled'
    group by ${orderItems.drinkName}, ${orderItems.selection}
    order by 3 desc
    limit ${limit}
  `);
  return rows.rows;
}

/** The "ideal coffee": the most chosen option in each group. */
export function idealProfile(ingredients: IngredientRow[]) {
  const best = new Map<string, IngredientRow>();
  for (const row of ingredients) {
    const current = best.get(row.group_slug);
    if (row.cups > 0 && (!current || row.cups > current.cups)) best.set(row.group_slug, row);
  }
  return [...best.values()];
}

export type CustomerPreference = {
  id: string;
  name: string;
  email: string;
  orders: number;
  favorites: { name: string; cups: number }[];
  neverTried: string[];
  rarelyUsed: { name: string; cups: number }[];
};

/**
 * Per-customer favourites and gaps, ONLY for customers who opted in to
 * personalized analytics. For internal offers; never for sale or export.
 */
export async function customerPreferences(popular: IngredientRow[], limit = 50): Promise<CustomerPreference[]> {
  const rows = await db.execute<{ id: string; name: string; email: string; orders: number; slug: string | null; option_name: string | null; cups: number | null }>(sql`
    with usage as (${usage}),
    consenting as (
      select ${user.id} as id, ${user.name} as name, ${user.email} as email,
             (select count(*)::int from ${orders} where ${orders.userId} = ${user.id} and ${orders.status} <> 'cancelled') as orders
      from ${user}
      where ${user.role} = 'customer' and ${user.analyticsConsent} = true
    )
    select c.id, c.name, c.email, c.orders, o.slug, o.name as option_name, sum(u.cups)::int as cups
    from consenting c
    left join usage u on u.user_id = c.id
    left join ${options} o on o.slug = u.slug
    left join ${optionGroups} g on g.id = o.group_id
    where c.orders > 0 and (g.slug is null or g.slug in (${addOnGroups}))
    group by c.id, c.name, c.email, c.orders, o.slug, o.name
  `);

  // Popular add-ons overall, to suggest what each customer hasn't tried yet.
  const popularAddOns = popular
    .filter((p) => ADD_ON_GROUPS.includes(p.group_slug) && p.cups > 0 && p.slug !== "no-milk" && p.slug !== "signature-roast")
    .sort((a, b) => b.cups - a.cups);

  const byCustomer = new Map<string, CustomerPreference & { used: Map<string, { name: string; cups: number }> }>();
  for (const r of rows.rows) {
    const entry =
      byCustomer.get(r.id) ??
      { id: r.id, name: r.name, email: r.email, orders: r.orders, favorites: [], neverTried: [], rarelyUsed: [], used: new Map() };
    if (r.slug && r.option_name && r.cups) entry.used.set(r.slug, { name: r.option_name, cups: r.cups });
    byCustomer.set(r.id, entry);
  }

  return [...byCustomer.values()]
    .map(({ used, ...c }) => {
      const sorted = [...used.values()].sort((a, b) => b.cups - a.cups);
      return {
        ...c,
        favorites: sorted.slice(0, 3),
        rarelyUsed: sorted.length > 3 ? sorted.slice(-2).reverse() : [],
        neverTried: popularAddOns.filter((p) => !used.has(p.slug)).slice(0, 3).map((p) => p.name),
      };
    })
    .sort((a, b) => b.orders - a.orders)
    .slice(0, limit);
}
