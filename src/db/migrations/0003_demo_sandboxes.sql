CREATE TABLE "demo_sandboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_sandboxes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "demo_sandboxes_id_check" CHECK ("demo_sandboxes"."id" ~ '^[a-z0-9]{16}$')
);
--> statement-breakpoint
ALTER TABLE "demo_sandboxes" ADD CONSTRAINT "demo_sandboxes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demo_sandboxes_expires_idx" ON "demo_sandboxes" USING btree ("expires_at");