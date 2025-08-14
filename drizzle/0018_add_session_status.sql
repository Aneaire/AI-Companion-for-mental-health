-- Add status field to sessions table
ALTER TABLE "sessions" ADD COLUMN "status" varchar DEFAULT 'active';

-- Add enum constraint for status field
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_status_check" CHECK ("status" IN ('active', 'finished')); 