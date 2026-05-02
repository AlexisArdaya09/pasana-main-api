ALTER TABLE "user_account" ALTER COLUMN "person_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "phone" varchar(30) NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "email" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "user_account" ADD COLUMN "email" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_phone_unique" UNIQUE("phone");--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_email_unique" UNIQUE("email");