ALTER TABLE "characters" ALTER COLUMN "skin" SET DEFAULT 'theo';--> statement-breakpoint
-- Skins renamed: the adventurer became Theo, the hat became Freddy.
UPDATE "characters" SET "skin" = 'theo' WHERE "skin" = 'default';--> statement-breakpoint
UPDATE "characters" SET "skin" = 'freddy' WHERE "skin" = 'hat';
