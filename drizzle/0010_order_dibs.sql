ALTER TABLE "branches" ADD COLUMN "shift_order_target" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "maker_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_maker_id_employees_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_maker_idx" ON "orders" USING btree ("maker_id","completed_at");