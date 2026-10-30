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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  // Key of the drink photo in the images table.
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
    // Key of the branch photo in the images table.
    imageKey: text("image_key"),
    // Where payslips are copied for documentation, e.g. the owner's accountant.
    recordsEmail: text("records_email"),
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
    // A free drink paid for with bean coins; totalCents is already reduced by discountCents.
    coinsUsed: integer("coins_used").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("orders_branch_idx").on(t.branchId, t.createdAt), index("orders_user_idx").on(t.userId)],
);

export const orderItems = pgTable(
  "order_items",
  {
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
    // Set when the line is someone's published signature drink, so its creator earns coins.
    signatureDrinkId: integer("signature_drink_id").references(() => signatureDrinks.id, { onDelete: "set null" }),
  },
  (t) => [index("order_items_signature_idx").on(t.signatureDrinkId)],
);

// Customers publish a saved recipe as a "signature drink". It goes public only
// after the admin approves it, and the recipe is locked: edits mean a new drink.
export const signatureDrinks = pgTable(
  "signature_drinks",
  {
    id: serial("id").primaryKey(),
    // Public share link: /d/{slug}
    slug: text("slug").notNull().unique(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id),
    name: text("name").notNull(),
    story: text("story").notNull().default(""),
    selection: jsonb("selection").$type<Record<string, number>>().notNull(),
    status: reviewStatus("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("signature_creator_idx").on(t.creatorId), index("signature_status_idx").on(t.status)],
);

// Public creator name for signature drinks and the leaderboard. Real names are never shown.
export const creatorProfiles = pgTable("creator_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  // Leaderboard listing is opt-in (Data Privacy Act).
  showOnLeaderboard: boolean("show_on_leaderboard").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Bean coins: an append-only ledger. Entries are never edited, only voided or
// reversed by a new entry. Earned coins can be spent once availableAt passes.
export const coinKind = pgEnum("coin_kind", ["purchase", "creator", "redeem", "refund", "adjust"]);

export const coinEntries = pgTable(
  "coin_entries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: coinKind("kind").notNull(),
    // Positive when earned, negative when spent.
    amount: integer("amount").notNull(),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    signatureDrinkId: integer("signature_drink_id").references(() => signatureDrinks.id, { onDelete: "set null" }),
    // e.g. "purchase:42" or "creator:42:7"; stops the same order paying out twice.
    idempotencyKey: text("idempotency_key").notNull().unique(),
    availableAt: timestamp("available_at").notNull().defaultNow(),
    voidedAt: timestamp("voided_at"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("coin_user_idx").on(t.userId, t.createdAt), index("coin_order_idx").on(t.orderId)],
);

// Payroll is a record only; the app never moves money.
export const employees = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    // The worker's own account, when they joined through an invite link. Staff the
    // owner added by hand have none and can't clock in or chat.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    position: text("position").notNull(),
    hourlyRateCents: integer("hourly_rate_cents").notNull(),
    // Payslips are emailed here.
    email: text("email"),
    // Where the owner sends this employee's pay, printed on payslips: bank, GCash, Maya or cash.
    payoutMethod: text("payout_method"),
    payoutAccountName: text("payout_account_name"),
    payoutAccountNumber: text("payout_account_number"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("employees_branch_user_idx").on(t.branchId, t.userId)],
);

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
    payslipEmailedAt: timestamp("payslip_emailed_at"),
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

// Each branch owes Brew Lab a platform fee on its paid sales. One row per branch
// per month records the amounts once the admin marks that month's fee as paid.
export const feeSettlements = pgTable(
  "fee_settlements",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    // "YYYY-MM" in Philippine time.
    month: text("month").notNull(),
    salesCents: integer("sales_cents").notNull(),
    feeCents: integer("fee_cents").notNull(),
    paidAt: timestamp("paid_at").notNull().defaultNow(),
    markedBy: text("marked_by").references(() => user.id, { onDelete: "set null" }),
    note: text("note").notNull().default(""),
  },
  (t) => [uniqueIndex("fee_branch_month_idx").on(t.branchId, t.month)],
);

// Profile pictures and branch photos, stored in the database itself. Images are
// resized WebP files of roughly 10-100 KB, kept as base64 text.
export const images = pgTable("images", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  data: text("data").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Support tickets: customers and branch owners message Brew Lab, and any admin
// or support agent answers from their own account. Every step is also written
// to the activity log, so each reply can be traced to a person.
export const supportStatus = pgEnum("support_status", ["open", "waiting_customer", "resolved"]);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    // The FAQ question the customer was reading when they wrote in, if any.
    topic: text("topic"),
    status: supportStatus("status").notNull().default("open"),
    assignedTo: text("assigned_to").references(() => user.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    firstResponseAt: timestamp("first_response_at"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("support_status_idx").on(t.status, t.lastMessageAt), index("support_user_idx").on(t.userId)],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    // Customers see support replies signed "Brew Lab Support", not the agent's name.
    fromSupport: boolean("from_support").notNull().default(false),
    // Notes between support staff; never shown to the customer.
    internal: boolean("internal").notNull().default(false),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("support_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

// A private, unguessable link a customer made to share one receipt or one
// week of orders on social media. The shared card never shows names or notes.
export const receiptShares = pgTable(
  "receipt_shares",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
    // Monday of the shared week, in the shop's timezone.
    weekStart: date("week_start"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("receipt_shares_order_idx").on(t.orderId), uniqueIndex("receipt_shares_week_idx").on(t.userId, t.weekStart)],
);

// Branches hire workers with a single-use invite link. The branch is the
// employer; Brew Lab only provides the app.
export const workerInvites = pgTable(
  "worker_invites",
  {
    token: text("token").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    position: text("position").notNull(),
    hourlyRateCents: integer("hourly_rate_cents").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp("expires_at").notNull(),
    usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
    usedAt: timestamp("used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("worker_invites_branch_idx").on(t.branchId, t.createdAt)],
);

// Clock-ins from the rotating QR code at the counter. Payroll hours are
// summed from these; changing them by hand needs the branch owner's password.
export const timeEntries = pgTable(
  "time_entries",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    clockIn: timestamp("clock_in").notNull(),
    clockOut: timestamp("clock_out"),
    // "qr" from the counter code, "manual" when the owner typed or fixed the times.
    source: text("source").notNull().default("qr"),
    editedBy: text("edited_by").references(() => user.id, { onDelete: "set null" }),
    editNote: text("edit_note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("time_entries_branch_idx").on(t.branchId, t.clockIn),
    index("time_entries_employee_idx").on(t.employeeId, t.clockIn),
    // Only one open shift per person.
    uniqueIndex("time_entries_open_idx")
      .on(t.employeeId)
      .where(sql`${t.clockOut} is null`),
  ],
);

// The employee lounge chat. Every conversation belongs to one branch:
// "branch" is everyone there (owner and active workers), "dm" is two people,
// "group" is a chat someone made with chosen coworkers.
export const conversationKind = pgEnum("conversation_kind", ["branch", "dm", "group"]);

export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    kind: conversationKind("kind").notNull(),
    title: text("title"),
    // "branchId:userA:userB" with the two ids sorted, so a pair has one DM per branch.
    dmKey: text("dm_key").unique(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("conversations_branch_idx").on(t.branchId, t.lastMessageAt),
    uniqueIndex("conversations_branch_group_idx")
      .on(t.branchId)
      .where(sql`${t.kind} = 'branch'`),
  ],
);

// Members of DMs and groups. For the branch-wide chat, rows only track what each person has read.
export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conversation_members_user_idx").on(t.userId)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("chat_messages_conversation_idx").on(t.conversationId, t.id)],
);
