-- AlterTable
ALTER TABLE "progress" ALTER COLUMN "value_max" DROP NOT NULL,
ALTER COLUMN "value_max" DROP DEFAULT;

-- Convert legacy `-1` sentinel value to NULL so unknown maximums
-- are expressed with a real SQL NULL rather than a magic number.
UPDATE "progress" SET "value_max" = NULL WHERE "value_max" = -1;
