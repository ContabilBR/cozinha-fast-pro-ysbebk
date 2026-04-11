import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

// Enums
export const tableStatusEnum = pgEnum("table_status", ["livre", "ocupada", "reservada", "fechando"]);
export const orderStatusEnum = pgEnum("order_status", ["aberta", "fechando", "fechada", "cancelada"]);
export const orderItemStatusEnum = pgEnum("order_item_status", [
  "pendente",
  "recebido",
  "em_preparo",
  "pronto",
  "entregue",
  "cancelado",
]);

// Categories
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  icon: text("icon"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Dishes
export const dishes = pgTable("dishes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => categories.id),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  prepTimeMinutes: integer("prep_time_minutes").default(15),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Tables
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").notNull(),
    capacity: integer("capacity").notNull().default(4),
    status: tableStatusEnum("status").default("livre").notNull(),
    location: text("location"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    numberIdx: uniqueIndex("tables_number_idx").on(table.number),
  })
);

// Orders
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tableId: uuid("table_id").references(() => tables.id),
  waiterId: text("waiter_id").references(() => user.id),
  status: orderStatusEnum("status").default("aberta").notNull(),
  customerCount: integer("customer_count").default(1),
  notes: text("notes"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Order Items
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  dishId: uuid("dish_id").references(() => dishes.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  status: orderItemStatusEnum("status").default("pendente").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Action Logs
export const actionLogs = pgTable("action_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
