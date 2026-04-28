ALTER TABLE "comandas" ADD COLUMN "subtotal" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "comandas" ADD COLUMN "gorjeta" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "comandas_historico" ADD COLUMN "subtotal" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "comandas_historico" ADD COLUMN "gorjeta" numeric(10, 2) DEFAULT '0' NOT NULL;