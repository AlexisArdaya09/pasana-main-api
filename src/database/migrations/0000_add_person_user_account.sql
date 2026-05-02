CREATE TABLE "group" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"name" varchar(150) NOT NULL,
	"description" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"birthday" date NOT NULL,
	"dni" varchar(32) NOT NULL,
	CONSTRAINT "person_dni_unique" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE "user_account" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"person_id" text NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"password_expired" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_account_person_id_unique" UNIQUE("person_id"),
	CONSTRAINT "user_account_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;