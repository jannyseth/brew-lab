// Pure drink-building rules shared by the browser (live preview) and the
// server (authoritative price). Never trust a price sent from the client:
// always recompute it with priceDrink().

export type DrinkOption = {
  slug: string;
  name: string;
  priceDeltaCents: number;
  maxQuantity: number;
};

export type DrinkGroup = {
  slug: string;
  name: string;
  selection: "single" | "multi";
  minSelected: number;
  maxSelected: number;
  requiresOptionSlug: string | null;
  options: DrinkOption[];
};

export type DrinkConfig = {
  slug: string;
  name: string;
  description: string;
  basePriceCents: number;
  isCustom: boolean;
  defaults: Record<string, number>;
  groups: DrinkGroup[];
  /** Menu photo URL, if any. */
  photoUrl?: string | null;
};

/** Option slug -> quantity. */
export type Selection = Record<string, number>;

export type PriceResult =
  | { ok: true; totalCents: number }
  | { ok: false; errors: string[] };

/** Groups whose requirement (e.g. "Ice level" needs "Iced") is met. */
export function visibleGroups(drink: DrinkConfig, selection: Selection): DrinkGroup[] {
  let visible = drink.groups;
  // Repeat so a requirement on a hidden group's option also hides dependants.
  for (let i = 0; i < drink.groups.length; i++) {
    const selectedVisible = new Set(
      visible.flatMap((g) => g.options.filter((o) => selection[o.slug] > 0).map((o) => o.slug)),
    );
    const next = drink.groups.filter(
      (g) => g.requiresOptionSlug === null || selectedVisible.has(g.requiresOptionSlug),
    );
    if (next.length === visible.length) break;
    visible = next;
  }
  return visible;
}

/** Drops options from hidden groups and quantities that are out of range. */
export function normalizeSelection(drink: DrinkConfig, selection: Selection): Selection {
  const result: Selection = {};
  for (const group of visibleGroups(drink, selection)) {
    for (const option of group.options) {
      const qty = selection[option.slug];
      if (Number.isInteger(qty) && qty > 0) {
        result[option.slug] = Math.min(qty, option.maxQuantity);
      }
    }
  }
  return result;
}

/**
 * Normalizes a selection and picks the first option of any visible required
 * single-choice group left empty, e.g. "Ice level" right after choosing "Iced".
 */
export function completeSelection(drink: DrinkConfig, selection: Selection): Selection {
  const result = normalizeSelection(drink, selection);
  for (const group of visibleGroups(drink, result)) {
    const picked = group.options.some((o) => result[o.slug] > 0);
    if (!picked && group.selection === "single" && group.minSelected > 0 && group.options[0]) {
      result[group.options[0].slug] = 1;
    }
  }
  return result;
}

/** The drink's original recipe. */
export function initialSelection(drink: DrinkConfig): Selection {
  return completeSelection(drink, drink.defaults);
}

/**
 * Validates a selection and returns the price in cents.
 *
 * Single-choice groups (size, milk, ...) always charge their price delta.
 * In multi-choice groups (shots, syrups, toppings) the quantity in the
 * drink's recipe is included in the base price; only extras are charged.
 */
export function priceDrink(drink: DrinkConfig, selection: Selection): PriceResult {
  const errors: string[] = [];
  const visible = visibleGroups(drink, selection);
  const optionGroup = new Map<string, DrinkGroup>();
  for (const group of drink.groups) {
    for (const option of group.options) optionGroup.set(option.slug, group);
  }

  for (const [slug, qty] of Object.entries(selection)) {
    const group = optionGroup.get(slug);
    if (!group) errors.push(`Unknown option "${slug}".`);
    else if (!visible.includes(group)) errors.push(`"${slug}" isn't available with this drink setup.`);
    if (!Number.isInteger(qty) || qty < 1) errors.push(`Invalid quantity for "${slug}".`);
  }

  let totalCents = drink.basePriceCents;
  for (const group of visible) {
    const picked = group.options.filter((o) => selection[o.slug] > 0);
    if (picked.length < group.minSelected) errors.push(`Choose a ${group.name.toLowerCase()}.`);
    if (picked.length > group.maxSelected) {
      errors.push(`Choose at most ${group.maxSelected} for ${group.name.toLowerCase()}.`);
    }
    for (const option of picked) {
      const qty = selection[option.slug];
      if (qty > option.maxQuantity) {
        errors.push(`At most ${option.maxQuantity} × ${option.name}.`);
      }
      const charged = group.selection === "multi" ? Math.max(0, qty - (drink.defaults[option.slug] ?? 0)) : qty;
      totalCents += option.priceDeltaCents * charged;
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, totalCents };
}

/**
 * The price as receipt-style lines: the base drink, then every option that
 * costs extra. Uses the same charging rules as priceDrink(), so the lines
 * always add up to its total.
 */
export function priceBreakdown(drink: DrinkConfig, selection: Selection): { label: string; cents: number }[] {
  const lines = [{ label: drink.name, cents: drink.basePriceCents }];
  for (const group of visibleGroups(drink, selection)) {
    for (const option of group.options) {
      const qty = selection[option.slug] ?? 0;
      if (qty <= 0 || option.priceDeltaCents <= 0) continue;
      const charged = group.selection === "multi" ? Math.max(0, qty - (drink.defaults[option.slug] ?? 0)) : qty;
      if (charged === 0) continue;
      lines.push({
        label: charged > 1 ? `${charged} × ${option.name}` : option.name,
        cents: option.priceDeltaCents * charged,
      });
    }
  }
  return lines;
}

/** Human-readable summary, e.g. ["Medium", "Iced", "Oat milk", "3 × Vanilla"]. */
export function describeSelection(drink: DrinkConfig, selection: Selection): string[] {
  return visibleGroups(drink, selection).flatMap((group) =>
    group.options
      .filter((o) => selection[o.slug] > 0)
      .map((o) => (o.maxQuantity > 1 ? `${selection[o.slug]} × ${o.name}` : o.name)),
  );
}

/** Formats an amount in centavos as pesos, e.g. 16500 → ₱165.00. */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(cents / 100);
}
