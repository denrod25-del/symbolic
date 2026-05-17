ALTER TABLE "ads" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "reviewed_by" text;
--> statement-breakpoint
UPDATE "ads" SET "status" = 'approved' WHERE "status" = 'pending';
