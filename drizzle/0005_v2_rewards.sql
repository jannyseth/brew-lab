CREATE TYPE "public"."coin_kind" AS ENUM('purchase', 'creator', 'redeem', 'refund', 'adjust');--> statement-breakpoint
CREATE TABLE "coin_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "coin_kind" NOT NULL,
	"amount" integer NOT NULL,
	"order_id" integer,
	"signature_drink_id" integer,
	"idempotency_key" text NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"voided_at" timestamp,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coin_entries_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"show_on_leaderboard" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "signature_drinks" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"creator_id" text NOT NULL,
	"menu_item_id" integer NOT NULL,
	"name" text NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"selection" jsonb NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "signature_drinks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "signature_drink_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coins_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "coin_entries" ADD CONSTRAINT "coin_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_entries" ADD CONSTRAINT "coin_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_entries" ADD CONSTRAINT "coin_entries_signature_drink_id_signature_drinks_id_fk" FOREIGN KEY ("signature_drink_id") REFERENCES "public"."signature_drinks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_drinks" ADD CONSTRAINT "signature_drinks_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_drinks" ADD CONSTRAINT "signature_drinks_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coin_user_idx" ON "coin_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "coin_order_idx" ON "coin_entries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "signature_creator_idx" ON "signature_drinks" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "signature_status_idx" ON "signature_drinks" USING btree ("status");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_signature_drink_id_signature_drinks_id_fk" FOREIGN KEY ("signature_drink_id") REFERENCES "public"."signature_drinks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_signature_idx" ON "order_items" USING btree ("signature_drink_id");