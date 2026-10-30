CREATE TABLE "receipt_shares" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_id" integer,
	"week_start" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipt_shares" ADD CONSTRAINT "receipt_shares_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_shares" ADD CONSTRAINT "receipt_shares_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_shares_order_idx" ON "receipt_shares" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_shares_week_idx" ON "receipt_shares" USING btree ("user_id","week_start");