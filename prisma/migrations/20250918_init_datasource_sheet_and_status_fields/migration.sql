-- Create enum Status if missing
DO $$ BEGIN
  CREATE TYPE "Status" AS ENUM ('draft','published','deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add publishing columns to DataSource
ALTER TABLE "DataSource" ADD COLUMN IF NOT EXISTS "status" "Status" NOT NULL DEFAULT 'published';
ALTER TABLE "DataSource" ADD COLUMN IF NOT EXISTS "last_edited_by" TEXT;
ALTER TABLE "DataSource" ADD COLUMN IF NOT EXISTS "last_edited_at" TIMESTAMPTZ;
ALTER TABLE "DataSource" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;
ALTER TABLE "DataSource" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMPTZ;

-- Create DataSourceSheet table if missing
DO $$ BEGIN
  CREATE TABLE "DataSourceSheet" (
    "id" BIGSERIAL PRIMARY KEY,
    "dataSourceId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "range" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "DataSourceSheet_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  );
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Indexes
DO $$ BEGIN
  CREATE INDEX "DataSourceSheet_dataSourceId_idx" ON "DataSourceSheet" ("dataSourceId");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Add publishing columns to Widget
ALTER TABLE "Widget" ADD COLUMN IF NOT EXISTS "status" "Status" NOT NULL DEFAULT 'published';
ALTER TABLE "Widget" ADD COLUMN IF NOT EXISTS "last_edited_by" TEXT;
ALTER TABLE "Widget" ADD COLUMN IF NOT EXISTS "last_edited_at" TIMESTAMPTZ;
ALTER TABLE "Widget" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;


