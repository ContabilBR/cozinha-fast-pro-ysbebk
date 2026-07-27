import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
  uniqueIndex,
  index,
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

// Restaurante (Restaurant information) — tenant anchor
export const restaurante = pgTable("restaurante", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  filial: text("filial"),
  endereco: text("endereco"),
  cnpj: text("cnpj"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Mesas (Tables)
export const mesas = pgTable(
  "mesas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    numero: integer("numero").notNull(),
    status: mesaStatusEnum("status").default("disponivel").notNull(),
    capacidade: integer("capacidade").default(4).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("mesas_restaurante_numero_unique").on(t.restauranteId, t.numero),
    index("idx_mesas_restaurante_id").on(t.restauranteId),
  ]
);

// Categorias
export const categorias = pgTable(
  "categorias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_categorias_restaurante_id").on(t.restauranteId)]
);

// Categoria Pratos (Dish Categories)
export const categoriaPratos = pgTable(
  "categoria_pratos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_categoria_pratos_restaurante_id").on(t.restauranteId)]
);

// Pratos (Dishes)
export const pratos = pgTable(
  "pratos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    preco: numeric("preco", { precision: 10, scale: 2 }).notNull(),
    categoriaId: uuid("categoria_id").references(() => categorias.id, { onDelete: "set null" }),
    imagemUrl: text("imagem_url"),
    disponivel: boolean("disponivel").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_pratos_restaurante_id").on(t.restauranteId)]
);

// Comandas (Orders/Bills)
export const comandas = pgTable(
  "comandas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    mesaId: uuid("mesa_id").notNull().references(() => mesas.id, { onDelete: "restrict" }),
    mesaNumero: integer("mesa_numero"),
    garcomId: text("garcom_id"),
    status: comandaStatusEnum("status").default("aberta").notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).default("0").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0").notNull(),
    gorjeta: numeric("gorjeta", { precision: 10, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("idx_comandas_restaurante_id").on(t.restauranteId)]
);

// Pedidos (Order Items)
export const pedidos = pgTable(
  "pedidos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    comandaId: uuid("comanda_id").notNull().references(() => comandas.id, { onDelete: "cascade" }),
    pratoId: uuid("prato_id").references(() => pratos.id, { onDelete: "set null" }),
    quantidade: integer("quantidade").default(1).notNull(),
    precoUnitario: numeric("preco_unitario", { precision: 10, scale: 2 }).notNull(),
    observacao: text("observacao"),
    status: pedidoStatusEnum("status").default("pendente").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_pedidos_restaurante_id").on(t.restauranteId)]
);

// Profiles for users
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("garcom"),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_profiles_restaurante_id").on(t.restauranteId)]
);

// Usuarios (App-level user management, separate from auth users)
export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    senhaHash: text("senha_hash"),
    role: text("role").notNull().default("garcom"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("usuarios_restaurante_email_unique").on(t.restauranteId, t.email),
    index("idx_usuarios_restaurante_id").on(t.restauranteId),
  ]
);

// Usuarios Session (for custom auth token management) — global, no restauranteId
export const usuariosSession = pgTable("usuarios_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Comandas Historico (Archived Orders)
export const comandasHistorico = pgTable(
  "comandas_historico",
  {
    id: uuid("id").primaryKey(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    mesaId: uuid("mesa_id"),
    mesaNumero: integer("mesa_numero"),
    garcomId: text("garcom_id"),
    status: text("status").notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).default("0").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0").notNull(),
    gorjeta: numeric("gorjeta", { precision: 10, scale: 2 }).default("0").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_comandas_historico_restaurante_id").on(t.restauranteId)]
);

// Pedidos Historico (Archived Order Items)
export const pedidosHistorico = pgTable(
  "pedidos_historico",
  {
    id: uuid("id").primaryKey(),
    restauranteId: uuid("restaurante_id").references(() => restaurante.id, { onDelete: "restrict" }),
    comandaId: uuid("comanda_id").notNull(),
    pratoId: uuid("prato_id"),
    pratoNome: text("prato_nome"),
    quantidade: integer("quantidade").notNull(),
    precoUnitario: numeric("preco_unitario", { precision: 10, scale: 2 }).notNull(),
    observacao: text("observacao"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_pedidos_historico_restaurante_id").on(t.restauranteId)]
);
