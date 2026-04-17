import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, desc, and, count } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface CreateOrderBody {
  table_id: string;
  waiter_id: string;
  customer_count?: number;
  notes?: string;
}

interface UpdateOrderBody {
  status?: string;
  customer_count?: number;
  notes?: string;
}

export function registerOrderRoutes(app: App) {
  // GET /api/orders
  app.fastify.get(
    "/api/orders",
    {
      schema: {
        description: "List all orders with table and waiter info",
        tags: ["orders"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                status: { type: "string", enum: ["aberta", "fechando", "fechada", "cancelada"] },
                customer_count: { type: "number" },
                notes: { type: "string" },
                opened_at: { type: "string", format: "date-time" },
                closed_at: { type: "string", format: "date-time" },
                total_amount: { type: "string" },
                created_at: { type: "string", format: "date-time" },
                table: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    number: { type: "number" },
                    capacity: { type: "number" },
                  },
                },
                waiter: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                  },
                },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({}, "Listing orders");

        const ordersWithCounts = await app.db
          .select({
            id: schema.orders.id,
            status: schema.orders.status,
            customer_count: schema.orders.customerCount,
            notes: schema.orders.notes,
            opened_at: schema.orders.openedAt,
            closed_at: schema.orders.closedAt,
            total_amount: schema.orders.totalAmount,
            created_at: schema.orders.createdAt,
            table_id: schema.tables.id,
            table_number: schema.tables.number,
            table_capacity: schema.tables.capacity,
            waiter_id: user.id,
            waiter_name: user.name,
            waiter_email: user.email,
            items_count: count(schema.orderItems.id),
          })
          .from(schema.orders)
          .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
          .leftJoin(user, eq(schema.orders.waiterId, user.id))
          .leftJoin(schema.orderItems, eq(schema.orders.id, schema.orderItems.orderId))
          .groupBy(schema.orders.id, schema.tables.id, user.id)
          .orderBy(desc(schema.orders.openedAt));

        const result = ordersWithCounts.map((row) => ({
          id: row.id,
          status: row.status,
          customer_count: row.customer_count,
          notes: row.notes,
          opened_at: row.opened_at,
          closed_at: row.closed_at,
          total_amount: row.total_amount,
          created_at: row.created_at,
          items_count: row.items_count,
          table: row.table_id
            ? {
                id: row.table_id,
                number: row.table_number,
                capacity: row.table_capacity,
              }
            : null,
          waiter: row.waiter_id
            ? {
                id: row.waiter_id,
                name: row.waiter_name,
                email: row.waiter_email,
              }
            : null,
        }));

        app.logger.info({ count: result.length }, "Orders listed");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list orders");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/orders
  app.fastify.post<{ Body: CreateOrderBody }>(
    "/api/orders",
    {
      schema: {
        description: "Create a new order",
        tags: ["orders"],
        body: {
          type: "object",
          required: ["table_id", "waiter_id"],
          properties: {
            table_id: { type: "string", format: "uuid" },
            waiter_id: { type: "string" },
            customer_count: { type: "number" },
            notes: { type: "string" },
          },
        },
        response: {
          201: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateOrderBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      if (!request.body.table_id || !request.body.waiter_id) {
        return reply.status(400).send({ error: "table_id and waiter_id are required" });
      }

      try {
        app.logger.info(
          { tableId: request.body.table_id, waiterId: request.body.waiter_id },
          "Creating order"
        );

        const [order] = await app.db
          .insert(schema.orders)
          .values({
            tableId: request.body.table_id,
            waiterId: request.body.waiter_id,
            customerCount: request.body.customer_count || 1,
            notes: request.body.notes,
            status: "aberta",
            totalAmount: "0",
          })
          .returning();

        // Update table status to ocupada
        await app.db
          .update(schema.tables)
          .set({ status: "ocupada" })
          .where(eq(schema.tables.id, request.body.table_id));

        // Fetch full order with relations
        const rows = await app.db
          .select()
          .from(schema.orders)
          .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
          .leftJoin(user, eq(schema.orders.waiterId, user.id))
          .where(eq(schema.orders.id, order.id));

        if (!rows || rows.length === 0) {
          return reply.status(500).send({ error: "Failed to retrieve created order" });
        }

        const row = rows[0];
        app.logger.info({ orderId: order.id }, "Order created");

        return reply.status(201).send({
          id: row.orders.id,
          status: row.orders.status,
          customer_count: row.orders.customerCount,
          notes: row.orders.notes,
          opened_at: row.orders.openedAt,
          closed_at: row.orders.closedAt,
          total_amount: row.orders.totalAmount,
          created_at: row.orders.createdAt,
          table: row.tables
            ? {
                id: row.tables.id,
                number: row.tables.number,
                capacity: row.tables.capacity,
              }
            : null,
          waiter: row.user
            ? {
                id: row.user.id,
                name: row.user.name,
                email: row.user.email,
              }
            : null,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to create order");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/orders/:id
  app.fastify.get<{ Params: { id: string } }>(
    "/api/orders/:id",
    {
      schema: {
        description: "Get a specific order with items",
        tags: ["orders"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: { type: "object" },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ orderId: request.params.id }, "Getting order");

        const rows = await app.db
          .select()
          .from(schema.orders)
          .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
          .leftJoin(user, eq(schema.orders.waiterId, user.id))
          .where(eq(schema.orders.id, request.params.id));

        if (!rows || rows.length === 0) {
          return reply.status(404).send({ error: "Order not found" });
        }

        const row = rows[0];

        // Fetch order items
        const items = await app.db
          .select()
          .from(schema.orderItems)
          .leftJoin(schema.dishes, eq(schema.orderItems.dishId, schema.dishes.id))
          .where(eq(schema.orderItems.orderId, request.params.id));

        const mappedItems = items.map((item) => ({
          id: item.order_items.id,
          dish_id: item.order_items.dishId,
          quantity: item.order_items.quantity,
          unit_price: item.order_items.unitPrice,
          notes: item.order_items.notes,
          status: item.order_items.status,
          requested_at: item.order_items.requestedAt,
          received_at: item.order_items.receivedAt,
          started_at: item.order_items.startedAt,
          ready_at: item.order_items.readyAt,
          delivered_at: item.order_items.deliveredAt,
          dish: item.dishes
            ? {
                name: item.dishes.name,
                price: item.dishes.price,
              }
            : null,
        }));

        app.logger.info({ orderId: request.params.id, itemCount: mappedItems.length }, "Order retrieved");

        return {
          id: row.orders.id,
          status: row.orders.status,
          customer_count: row.orders.customerCount,
          notes: row.orders.notes,
          opened_at: row.orders.openedAt,
          closed_at: row.orders.closedAt,
          total_amount: row.orders.totalAmount,
          created_at: row.orders.createdAt,
          table: row.tables
            ? {
                id: row.tables.id,
                number: row.tables.number,
                capacity: row.tables.capacity,
              }
            : null,
          waiter: row.user
            ? {
                id: row.user.id,
                name: row.user.name,
                email: row.user.email,
              }
            : null,
          items: mappedItems,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get order");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/orders/:id
  app.fastify.put<{ Params: { id: string }; Body: UpdateOrderBody }>(
    "/api/orders/:id",
    {
      schema: {
        description: "Update an order",
        tags: ["orders"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["aberta", "fechando", "fechada", "cancelada"] },
            customer_count: { type: "number" },
            notes: { type: "string" },
          },
        },
        response: {
          200: { type: "object" },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateOrderBody }>,
      reply: FastifyReply
    ) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ orderId: request.params.id }, "Updating order");

        const existing = await app.db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
          return reply.status(404).send({ error: "Order not found" });
        }

        const updates: any = {};
        if (request.body.status !== undefined) updates.status = request.body.status;
        if (request.body.customer_count !== undefined) updates.customerCount = request.body.customer_count;
        if (request.body.notes !== undefined) updates.notes = request.body.notes;

        // If closing order, set closedAt
        if (request.body.status === "fechada" || request.body.status === "cancelada") {
          updates.closedAt = new Date();
        }

        const [updated] = await app.db
          .update(schema.orders)
          .set(updates)
          .where(eq(schema.orders.id, request.params.id))
          .returning();

        // Update table status if order is being closed
        if (request.body.status === "fechada" || request.body.status === "cancelada") {
          await app.db
            .update(schema.tables)
            .set({ status: "livre" })
            .where(eq(schema.tables.id, updated.tableId));
        }

        // Fetch full order with relations
        const rows = await app.db
          .select({
            id: schema.orders.id,
            status: schema.orders.status,
            customer_count: schema.orders.customerCount,
            notes: schema.orders.notes,
            opened_at: schema.orders.openedAt,
            closed_at: schema.orders.closedAt,
            total_amount: schema.orders.totalAmount,
            created_at: schema.orders.createdAt,
            table_id: schema.tables.id,
            table_number: schema.tables.number,
            table_capacity: schema.tables.capacity,
            waiter_id: user.id,
            waiter_name: user.name,
            waiter_email: user.email,
          })
          .from(schema.orders)
          .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
          .leftJoin(user, eq(schema.orders.waiterId, user.id))
          .where(eq(schema.orders.id, updated.id));

        const row = rows[0];
        app.logger.info({ orderId: updated.id }, "Order updated");

        return {
          id: row.id,
          status: row.status,
          customer_count: row.customer_count,
          notes: row.notes,
          opened_at: row.opened_at,
          closed_at: row.closed_at,
          total_amount: row.total_amount,
          created_at: row.created_at,
          table: row.table_id
            ? {
                id: row.table_id,
                number: row.table_number,
                capacity: row.table_capacity,
              }
            : null,
          waiter: row.waiter_id
            ? {
                id: row.waiter_id,
                name: row.waiter_name,
                email: row.waiter_email,
              }
            : null,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update order");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
