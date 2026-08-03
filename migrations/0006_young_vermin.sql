CREATE TABLE "crm_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"contact_id" integer NOT NULL,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE cascade ON UPDATE no action;