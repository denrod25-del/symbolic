CREATE TABLE "crm_workflow_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"workflow_id" integer NOT NULL,
	"contact_id" integer,
	"status" text NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_type" text NOT NULL,
	"action_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_workflow_id_crm_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."crm_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE set null ON UPDATE no action;