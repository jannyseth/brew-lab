CREATE TABLE "fee_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"month" text NOT NULL,
	"sales_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"marked_by" text,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "records_email" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "payout_method" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "payout_account_name" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "payout_account_number" text;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD COLUMN "payslip_emailed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "analytics_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "analytics_consent_at" timestamp;--> statement-breakpoint
ALTER TABLE "fee_settlements" ADD CONSTRAINT "fee_settlements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_settlements" ADD CONSTRAINT "fee_settlements_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_branch_month_idx" ON "fee_settlements" USING btree ("branch_id","month");