import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

// Enums
export const mesaStatusEnum = pgEnum("mesa_status", ["disponivel", "ocupada", "reservada"]);
export const comandaStatusEnum = pgEnum("comanda_status", ["aberta", "fechada", "cancelada"]);
export const pedidoStatusEnum = pgEnum("pedido_status", [
  "pendente",
  "em_preparo",
  "pronto",
  "entregue",
  "cancelado",
]);

// Mesas (Tables)
export const mesas = pgTable("mesas", {
  id: uuid("id").primaryKey().defaultRandom(),
  numero: integer("numero").notNull().unique(),
  status: mesaStatusEnum("status").default("disponivel").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Categoria Pratos (Dish Categories)
export const categoriaPratos = pgTable("categoria_pratos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Pratos (Dishes)
export const pratos = pgTable("pratos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: numeric("preco", { precision: 10, scale: 2 }).notNull(),
  categoriaId: uuid("categoria_id").references(() => categoriaPratos.id, { onDelete: "set null" }),
  imagemUrl: text("imagem_url"),
  disponivel: boolean("disponivel").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Comandas (Orders/Bills)
export const comandas = pgTable("comandas", {
  id: uuid("id").primaryKey().defaultRandom(),
  mesaId: uuid("mesa_id").notNull().references(() => mesas.id, { onDelete: "restrict" }),
  garcomId: text("garcom_id").references(() => user.id, { onDelete: "set null" }),
  status: comandaStatusEnum("status").default("aberta").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

// Pedidos (Order Items)
export const pedidos = pgTable("pedidos", {
  id: uuid("id").primaryKey().defaultRandom(),
  comandaId: uuid("comanda_id").notNull().references(() => comandas.id, { onDelete: "cascade" }),
  pratoId: uuid("prato_id").references(() => pratos.id, { onDelete: "set null" }),
  quantidade: integer("quantidade").default(1).notNull(),
  precoUnitario: numeric("preco_unitario", { precision: 10, scale: 2 }).notNull(),
  observacao: text("observacao"),
  status: pedidoStatusEnum("status").default("pendente").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Profiles for users
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("garcom"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
