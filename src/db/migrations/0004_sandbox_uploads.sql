CREATE TABLE "sandbox_uploads" (
	"key" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_uploads_key_check" CHECK ("sandbox_uploads"."key" ~ '^sbx-[a-zA-Z0-9-]+[.]webp$')
);
