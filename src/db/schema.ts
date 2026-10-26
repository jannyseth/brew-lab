import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

// Prices are stored as integer cents to avoid floating-point rounding errors.

export const selectionType = pgEnum("selection_type", ["single", "multi"]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  basePriceCents: integer("base_price_cents").notNull(),
  // R2 object key for the drink photo (added in phase 3).
  imageKey: text("image_key"),
  // Option slug -> quantity, applied when the builder opens.
  defaults: jsonb("defaults").$type<Record<string, number>>().notNull().default({}),
  isCustom: boolean("is_custom").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const optionGroups = pgTable("option_groups", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  selection: selectionType("selection").notNull(),
  // Minimum and maximum number of distinct options picked in this group.
  minSelected: integer("min_selected").notNull().default(0),
  maxSelected: integer("max_selected").notNull().default(1),
  // Group is only shown (and only counted) when this option is selected,
  // e.g. "Ice level" requires "Iced".
  requiresOptionSlug: text("requires_option_slug"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const options = pgTable("options", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  groupId: integer("group_id")
    .notNull()
    .references(() => optionGroups.id),
  name: text("name").notNull(),
  // Charged once per unit of quantity.
  priceDeltaCents: integer("price_delta_cents").notNull().default(0),
  // 1 = simple toggle; >1 = counter such as syrup pumps or extra shots.
  maxQuantity: integer("max_quantity").notNull().default(1),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const menuItemOptionGroups = pgTable(
  "menu_item_option_groups",
  {
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    // Restricts the group to these options for this drink (null = all),
    // e.g. cold brew only allows "Iced".
    allowedOptionSlugs: text("allowed_option_slugs").array(),
  },
  (t) => [primaryKey({ columns: [t.menuItemId, t.groupId] })],
);

// Approval workflow: a manager application, and later each branch, stays
// "pending" until a super admin reviews it. Customers only see approved branches.
export const reviewStatus = pgEnum("review_status", ["pending", "approved", "rejected"]);

export const managerApplications = pgTable("manager_applications", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  message: text("message").notNull().default(""),
  status: reviewStatus("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const branches = pgTable(
  "branches",
  {
    id: serial("id").primaryKey(),
    managerId: text("manager_id")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    address: text("address").notNull(),
    hours: text("hours").notNull(),
    status: reviewStatus("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("branches_manager_idx").on(t.managerId)],
);

export const savedDrinks = pgTable(
  "saved_drinks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    selection: jsonb("selection").$type<Record<string, number>>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("saved_drinks_user_idx").on(t.userId)],
);

export const orderStatus = pgEnum("order_status", ["placed", "preparing", "ready", "completed", "cancelled"]);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id),
    status: orderStatus("status").notNull().default("placed"),
    // Customers pay at pickup; the manager marks the order paid at the counter.
    paidAt: timestamp("paid_at"),
    totalCents: integer("total_cents").notNull(),
    pickupName: text("pickup_name").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("orders_branch_idx").on(t.branchId, t.createdAt), index("orders_user_idx").on(t.userId)],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").references(() => menuItems.id, { onDelete: "set null" }),
  // Snapshot of what was ordered, so later menu edits don't change past orders.
  drinkName: text("drink_name").notNull(),
  summary: text("summary").notNull(),
  selection: jsonb("selection").$type<Record<string, number>>().notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
});

// Payroll is a record only; the app never moves money.
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: text("position").notNull(),
  hourlyRateCents: integer("hourly_rate_cents").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollEntries = pgTable(
  "payroll_entries",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note").notNull().default(""),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("payroll_branch_idx").on(t.branchId, t.periodStart)],
);

// Every approved branch holds a 1-year license. At expiry it renews for another
// year only if the branch's paid sales during that year reached the quota.
export const licenseStatus = pgEnum("license_status", ["active", "renewed", "expired", "revoked"]);

export const branchLicenses = pgTable(
  "branch_licenses",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    licenseNumber: text("license_number").notNull().unique(),
    issuedAt: timestamp("issued_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    quotaCents: integer("quota_cents").notNull(),
    status: licenseStatus("status").notNull().default("active"),
    // Paid sales during the license year, recorded when it is evaluated at expiry.
    salesCents: integer("sales_cents"),
    evaluatedAt: timestamp("evaluated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("licenses_branch_idx").on(t.branchId, t.status)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    // Kept even if the user is deleted, so the log stays readable.
    userEmail: text("user_email"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_user_idx").on(t.userId)],
);
