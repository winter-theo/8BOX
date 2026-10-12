CREATE TABLE "characters" (
	"player_id" integer PRIMARY KEY NOT NULL,
	"layer" smallint NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"hp" integer,
	"hunger" integer,
	"inventory" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"spawn_point" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"layer" smallint NOT NULL,
	"cx" integer NOT NULL,
	"cy" integer NOT NULL,
	"palette" jsonb NOT NULL,
	"data" "bytea" NOT NULL,
	"meta" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"has_player_build" boolean DEFAULT false NOT NULL,
	"version" smallint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chunks_layer_cx_cy_pk" PRIMARY KEY("layer","cx","cy")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "players_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"clerk_user_id" text,
	"email" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"ban_reason" text,
	"muted_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "players_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "world_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "players_name_lower_idx" ON "players" USING btree (lower("name"));