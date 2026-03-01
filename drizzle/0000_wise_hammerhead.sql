CREATE TYPE "public"."assignment_status" AS ENUM('pending', 'confirmed', 'declined');--> statement-breakpoint
CREATE TYPE "public"."availability_response_value" AS ENUM('available', 'maybe', 'not_available');--> statement-breakpoint
CREATE TYPE "public"."availability_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('rehearsal', 'show', 'other');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "availability_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"date_range_start" timestamp with time zone NOT NULL,
	"date_range_end" timestamp with time zone NOT NULL,
	"requested_dates" jsonb NOT NULL,
	"status" "availability_status" DEFAULT 'open' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "availability_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"responses" jsonb NOT NULL,
	"responded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(100),
	"status" "assignment_status" DEFAULT 'pending' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"event_type" "event_type" DEFAULT 'other' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"location" varchar(500),
	"created_by_id" uuid NOT NULL,
	"created_from_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "group_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"invite_code" varchar(8) NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"name" varchar(255) NOT NULL,
	"profile_image" text,
	"google_id" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_request_id_availability_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."availability_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_from_request_id_availability_requests_id_fk" FOREIGN KEY ("created_from_request_id") REFERENCES "public"."availability_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_requests_group_id_idx" ON "availability_requests" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "availability_responses_request_user_idx" ON "availability_responses" USING btree ("request_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_assignments_event_user_idx" ON "event_assignments" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_assignments_user_id_idx" ON "event_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_group_start_time_idx" ON "events" USING btree ("group_id","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_group_user_idx" ON "group_memberships" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_memberships_user_id_idx" ON "group_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "groups_invite_code_idx" ON "groups" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_google_id_idx" ON "users" USING btree ("google_id");