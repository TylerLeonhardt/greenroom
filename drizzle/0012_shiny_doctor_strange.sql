CREATE TABLE "rsvp_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"previous_status" "assignment_status",
	"new_status" "assignment_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rsvp_changes" ADD CONSTRAINT "rsvp_changes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_changes" ADD CONSTRAINT "rsvp_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rsvp_changes_event_id_idx" ON "rsvp_changes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "rsvp_changes_event_changed_at_idx" ON "rsvp_changes" USING btree ("event_id","changed_at");