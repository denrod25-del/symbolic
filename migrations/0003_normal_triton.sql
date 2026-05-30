CREATE TABLE "searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
