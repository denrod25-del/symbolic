CREATE TABLE "news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"image_url" text,
	"published_at" timestamp NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "news_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"hidden_sources" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "news_preferences_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
