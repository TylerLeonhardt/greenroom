ALTER TABLE "availability_requests" ADD COLUMN "requested_start_time" varchar(5);--> statement-breakpoint
ALTER TABLE "availability_requests" ADD COLUMN "requested_end_time" varchar(5);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(100);