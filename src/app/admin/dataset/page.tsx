import type { Metadata } from "next";
import { AreaTitle } from "@/components/area-shell";
import { ActivityHeatmap, BarList } from "@/components/charts";
import { buttonSecondary, cardClass } from "@/components/ui";
import { activityByHour, topDrinks } from "@/lib/analytics";
import { commonCombinations, customerPreferences, idealProfile, ingredientPopularity, popularRecipes } from "@/lib/dataset";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Dataset" };

const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

export default async function DatasetPage() {
  await requireRole(["super_admin"], "/admin/dataset");
  const [ingredients, combos, recipes, activity, menu] = await Promise.all([
    ingredientPopularity(),
    commonCombinations(),
    popularRecipes(),
    activityByHour("all", 90),
    topDrinks("all", "all", 10),
  ]);
  const customers = await customerPreferences(ingredients);
  const ideal = idealProfile(ingredients);
  const peak = [...activity].sort((a, b) => b.orders - a.orders)[0];

  const groups = [...new Set(ingredients.map((i) => i.group_name))];
  const leastUsed = ingredients.filter((i) => !["size", "temperature", "ice"].includes(i.group_slug)).sort((a, b) => a.cups - b.cups).slice(0, 6);

  return (
    <div>
      <AreaTitle
        title="Dataset"
        subtitle="What people actually drink: ingredients, combinations, recipes and busy hours across every branch."
        actions={
          <a href="/api/exports/admin/dataset" className={buttonSecondary} download>
            Download anonymous dataset
          </a>
        }
      />

      <section className={`${cardClass} border-accent bg-accent-soft`}>
        <h2 className="font-semibold">The ideal coffee</h2>
        <p className="mt-1 text-sm text-muted">The most chosen option in every category. This is the drink your customers would design together.</p>
        {ideal.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Not enough orders yet.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {ideal.map((i) => (
              <li key={i.group_slug} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm">
                <span className="text-muted">{i.group_name}:</span> <span className="font-medium">{i.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="mb-1 font-semibold">Most-sold menu items</h2>
          <p className="mb-4 text-xs text-muted">All time, by cups sold.</p>
          <BarList items={menu.map((m) => ({ label: m.name, value: m.cups, note: "" }))} format="count" />
        </section>
        <section className={cardClass}>
          <h2 className="mb-1 font-semibold">When customers order</h2>
          <p className="mb-4 text-xs text-muted">
            Last 90 days.{" "}
            {peak && (
              <>
                Busiest: <span className="font-medium text-foreground">{DAYS[peak.dow]} around {hourLabel(peak.hour)}</span>.
              </>
            )}
          </p>
          <ActivityHeatmap cells={activity} />
        </section>
      </div>

      <section className={`${cardClass} mt-6`}>
        <h2 className="mb-1 font-semibold">Ingredients by popularity</h2>
        <p className="mb-4 text-xs text-muted">Cups that included each option. Shots and syrup pumps count once per cup.</p>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <div key={group}>
              <h3 className="mb-3 text-sm font-semibold">{group}</h3>
              <BarList
                items={ingredients.filter((i) => i.group_name === group).map((i) => ({ label: i.name, value: i.cups }))}
                format="count"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="mb-1 font-semibold">Common combinations</h2>
          <p className="mb-4 text-xs text-muted">Add-ons most often chosen together in the same cup.</p>
          <BarList items={combos.map((c) => ({ label: `${c.first} + ${c.second}`, value: c.cups }))} format="count" />
        </section>
        <section className={cardClass}>
          <h2 className="mb-1 font-semibold">Least used</h2>
          <p className="mb-4 text-xs text-muted">Options customers rarely pick: candidates for promos, bundles or removal.</p>
          <BarList items={leastUsed.map((i) => ({ label: `${i.name} (${i.group_name})`, value: i.cups }))} format="count" />
        </section>
      </div>

      <section className={`${cardClass} mt-6`}>
        <h2 className="mb-4 font-semibold">Most-ordered exact recipes</h2>
        {recipes.length === 0 ? (
          <p className="text-sm text-muted">No orders yet.</p>
        ) : (
          <ol className="divide-y divide-line text-sm">
            {recipes.map((r, i) => (
              <li key={`${r.drink}-${i}`} className="flex justify-between gap-4 py-2">
                <span>
                  <span className="font-medium">
                    {i + 1}. {r.drink}
                  </span>
                  <span className="block text-xs text-muted">{r.summary}</span>
                </span>
                <span className="shrink-0 tabular-nums">{r.cups} cups</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={`${cardClass} mt-6`}>
        <h2 className="font-semibold">Customer preferences</h2>
        <p className="mt-1 text-xs text-muted">
          Only customers who opted in to personalized offers appear here. This list is for your own offers and is never part of the
          dataset you share or sell.
        </p>
        {customers.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No opted-in customers with orders yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Customer</th>
                  <th className="py-2 pr-4 text-right font-medium">Orders</th>
                  <th className="py-2 pr-4 font-medium">Favourites</th>
                  <th className="py-2 pr-4 font-medium">Rarely uses</th>
                  <th className="py-2 font-medium">Popular, never tried</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-line align-top last:border-0">
                    <td className="py-2 pr-4">
                      <span className="font-medium">{c.name || "—"}</span>
                      <span className="block text-xs text-muted">{c.email}</span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{c.orders}</td>
                    <td className="py-2 pr-4">{c.favorites.map((f) => `${f.name} (${f.cups})`).join(", ") || "—"}</td>
                    <td className="py-2 pr-4">{c.rarelyUsed.map((f) => `${f.name} (${f.cups})`).join(", ") || "—"}</td>
                    <td className="py-2">{c.neverTried.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
