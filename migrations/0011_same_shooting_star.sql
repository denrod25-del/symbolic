CREATE TABLE "crm_booking_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"slug" text NOT NULL,
	"business_name" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"default_duration_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_booking_settings_owner_clerk_user_id_unique" UNIQUE("owner_clerk_user_id"),
	CONSTRAINT "crm_booking_settings_slug_unique" UNIQUE("slug")
);
