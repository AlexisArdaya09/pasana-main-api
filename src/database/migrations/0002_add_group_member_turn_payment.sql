CREATE TYPE "public"."frequency" AS ENUM('WEEKLY', 'MONTHLY', 'BIRTHDAY');--> statement-breakpoint
CREATE TYPE "public"."group_status" AS ENUM('ACTIVE', 'COMPLETED', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."turn_status" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "group_member" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"group_id" text NOT NULL,
	"person_id" text NOT NULL,
	"turn_order" integer NOT NULL,
	"status" "member_status" DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turn" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"group_id" text NOT NULL,
	"turn_number" integer NOT NULL,
	"beneficiary_id" text NOT NULL,
	"status" "turn_status" DEFAULT 'PENDING' NOT NULL,
	"total_expected_amount" numeric(12, 2) NOT NULL,
	"total_paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"scheduled_date" date NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"turn_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "frequency" "frequency" DEFAULT 'MONTHLY' NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "contribution_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "group" ADD COLUMN "status" "group_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn" ADD CONSTRAINT "turn_group_id_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turn" ADD CONSTRAINT "turn_beneficiary_id_person_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_turn_id_turn_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."turn"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_participant_id_person_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_member_person" ON "group_member" USING btree ("group_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_group_member_order" ON "group_member" USING btree ("group_id","turn_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_turn_group_number" ON "turn" USING btree ("group_id","turn_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_turn_participant" ON "payment" USING btree ("turn_id","participant_id");