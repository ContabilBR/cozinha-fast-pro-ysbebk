import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  pgEnum,
  unique,
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
export const formaPagamentoEnum = pgEnum("forma_pagamento", ["pix", "dinheiro", "cartao_credito", "cartao_debito"]);
export const pagamentoStatusEnum = pgEnum("pagamento_status", ["pendente", "confirmado", "cancelado"]);

// Mesas (Tables)
export const mesas = pgTable("mesas", {
  id: uuid("id").primaryKey().defaultRandom(),
  numero: integer("numero").notNull(),
  status: mesaStatusEnum("status").default("disponivel").notNull(),
  capacidade: integer("capacidade").default(4).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
}, (table) => ({
  unqNumeroRestaurante: unique().on(table.numero, table.restauranteId),
}));

// Categorias
export const categorias = pgTable("categorias", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Categoria Pratos (Dish Categories)
export const categoriaPratos = pgTable("categoria_pratos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Pratos (Dishes)
export const pratos = pgTable("pratos", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: numeric("preco", { precision: 10, scale: 2 }).notNull(),
  categoriaId: uuid("categoria_id").references(() => categorias.id, { onDelete: "set null" }),
  imagemUrl: text("imagem_url"),
  disponivel: boolean("disponivel").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Comandas (Orders/Bills)
export const comandas = pgTable("comandas", {
  id: uuid("id").primaryKey().defaultRandom(),
  mesaId: uuid("mesa_id").notNull().references(() => mesas.id, { onDelete: "restrict" }),
  mesaNumero: integer("mesa_numero"),
  garcomId: text("garcom_id"),
  status: comandaStatusEnum("status").default("aberta").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).default("0").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0").notNull(),
  gorjeta: numeric("gorjeta", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
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
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Pagamentos (Payments)
export const pagamentos = pgTable("pagamentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  comandaId: uuid("comanda_id").notNull().references(() => comandas.id, { onDelete: "cascade" }),
  formaPagamento: formaPagamentoEnum("forma_pagamento").notNull(),
  status: pagamentoStatusEnum("status").default("pendente").notNull(),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  troco: numeric("troco", { precision: 10, scale: 2 }).default("0").notNull(),
  pixTxId: text("pix_tx_id"),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  referencia: text("referencia"),
  confirmadoEm: timestamp("confirmado_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Profiles for users
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("garcom"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Usuarios (App-level user management, separate from auth users)
export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  senhaHash: text("senha_hash"),
  role: text("role").notNull().default("garcom"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Usuarios Session (for custom auth token management)
export const usuariosSession = pgTable("usuarios_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Comandas Historico (Archived Orders)
export const comandasHistorico = pgTable("comandas_historico", {
  id: uuid("id").primaryKey(),
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
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Pedidos Historico (Archived Order Items)
export const pedidosHistorico = pgTable("pedidos_historico", {
  id: uuid("id").primaryKey(),
  comandaId: uuid("comanda_id").notNull(),
  pratoId: uuid("prato_id"),
  pratoNome: text("prato_nome"),
  quantidade: integer("quantidade").notNull(),
  precoUnitario: numeric("preco_unitario", { precision: 10, scale: 2 }).notNull(),
  observacao: text("observacao"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Pagamentos Historico (Archived Payments)
export const pagamentosHistorico = pgTable("pagamentos_historico", {
  id: uuid("id").primaryKey(),
  comandaId: uuid("comanda_id").notNull(),
  formaPagamento: text("forma_pagamento").notNull(),
  status: text("status").notNull(),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  troco: numeric("troco", { precision: 10, scale: 2 }).default("0").notNull(),
  pixTxId: text("pix_tx_id"),
  referencia: text("referencia"),
  confirmadoEm: timestamp("confirmado_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }).defaultNow().notNull(),
  restauranteId: uuid("restaurante_id").notNull().references(() => restaurante.id, { onDelete: "restrict" }),
});

// Restaurante (Restaurant information)
export const restaurante = pgTable("restaurante", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  filial: text("filial"),
  endereco: text("endereco"),
  cnpj: text("cnpj"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
