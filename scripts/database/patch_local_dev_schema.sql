-- Bring staging backup schema up to current app expectations for local dev.

ALTER TABLE clergy ADD COLUMN IF NOT EXISTS exclude_from_visualization BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ordination ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE ordination ADD COLUMN IF NOT EXISTS is_doubtfully_valid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ordination ADD COLUMN IF NOT EXISTS is_doubtful_event BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ordination ADD COLUMN IF NOT EXISTS details_unknown BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ordination ADD COLUMN IF NOT EXISTS is_inherited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ordination ADD COLUMN IF NOT EXISTS is_other BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ordination ADD COLUMN IF NOT EXISTS optional_notes TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ordination' AND column_name = 'is_doubtful'
  ) THEN
    UPDATE ordination SET is_doubtfully_valid = COALESCE(is_doubtful, false);
    ALTER TABLE ordination DROP COLUMN is_doubtful;
  END IF;
END $$;

ALTER TABLE ordination ALTER COLUMN date DROP NOT NULL;

ALTER TABLE consecration ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE consecration ADD COLUMN IF NOT EXISTS is_doubtfully_valid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE consecration ADD COLUMN IF NOT EXISTS is_doubtful_event BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE consecration ADD COLUMN IF NOT EXISTS details_unknown BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE consecration ADD COLUMN IF NOT EXISTS is_inherited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE consecration ADD COLUMN IF NOT EXISTS is_other BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE consecration ADD COLUMN IF NOT EXISTS optional_notes TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'consecration' AND column_name = 'is_doubtful'
  ) THEN
    UPDATE consecration SET is_doubtfully_valid = COALESCE(is_doubtful, false);
    ALTER TABLE consecration DROP COLUMN is_doubtful;
  END IF;
END $$;

ALTER TABLE consecration ALTER COLUMN date DROP NOT NULL;

CREATE TABLE IF NOT EXISTS alembic_version (
  version_num VARCHAR(32) NOT NULL,
  CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

DELETE FROM alembic_version;
INSERT INTO alembic_version (version_num) VALUES ('20260726_religious_name');
