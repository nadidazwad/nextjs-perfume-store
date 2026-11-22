CREATE TABLE "setup_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"business" text NOT NULL,
	"contact" text NOT NULL,
	"link" text,
	"plan" text NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "setup_requests_created_idx" ON "setup_requests" USING btree ("created_at");