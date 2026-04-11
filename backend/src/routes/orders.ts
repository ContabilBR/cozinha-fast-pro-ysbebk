import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

interface CreateOrderBody {
  tableId: string;
  waiterId?: string;
  customerCount?: number;
  notes?: string;
}

interface UpdateOrderBody {
  status?: "aberta" | "fechando" | "fechada" | "cancelada";
  notes?: string;
  customerCount?: number;
}

interface OrderQuery {
  status?: string;
  table_id?: string;
  waiter_id?: string;
  date_from?: string;
  date_to?: string;
}

export function registerOrderRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/orders
  app.fastify.get<{ Querystring: OrderQuery }>(
    "/api/orders",
    {
      schema: {
        description: "List orders with filters",
        tags: ["orders"],
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            table_id: { type: "string", format: "uuid" },
            waiter_id: { type: "string" },
            date_from: { type: "string" },
            date_to: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                tableId: { type: "string", format: "uuid" },
                waiterId: { type: "string" },
                status: { type: "string" },
                customerCount: { type: "number" },
                notes: { type: "string" },
                openedAt: { type: "string", format: "date-time" },
                closedAt: { type: "string", format: "date-time" },
                totalAmount: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: OrderQuery }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ query: request.query }, "Listing orders");

      const conditions: any[] = [];
      if (request.query.status) {
        conditions.push(eq(schema.orders.status, request.query.status as any));
      }
      if (request.query.table_id) {
        conditions.push(eq(schema.orders.tableId, request.query.table_id));
      }
      if (request.query.waiter_id) {
        conditions.push(eq(schema.orders.waiterId, request.query.waiter_id));
      }
      if (request.query.date_from) {
        conditions.push(sql`${schema.orders.openedAt} >= ${new Date(request.query.date_from)}`);
      }
      if (request.query.date_to) {
        conditions.push(sql`${schema.orders.openedAt} <= ${new Date(request.query.date_to)}`);
      }

      let orders;
      if (conditions.length > 0) {
        orders = await app.db.select().from(schema.orders).where(and(...conditions));
      } else {
        orders = await app.db.select().from(schema.orders);
      }

      app.logger.info({ count: orders.length }, "Orders listed");
      return orders;
    }
  );

  // POST /api/orders
  app.fastify.post<{ Body: CreateOrderBody }>(
    "/api/orders",
    {
      schema: {
        description: "Open new order",
        tags: ["orders"],
        body: {
          type: "object",
          required: ["tableId"],
          properties: {
            tableId: { type: "string", format: "uuid" },
            waiterId: { type: "string" },
            customerCount: { type: "number" },
            notes: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              tableId: { type: "string", format: "uuid" },
              waiterId: { type: "string" },
              status: { type: "string" },
              customerCount: { type: "number" },
              notes: { type: "string" },
              openedAt: { type: "string", format: "date-time" },
              closedAt: { type: "string", format: "date-time" },
              totalAmount: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateOrderBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ tableId: request.body.tableId }, "Creating new order");

      const [created] = await app.db
        .insert(schema.orders)
        .values({
          tableId: request.body.tableId,
          waiterId: request.body.waiterId || session.user.id,
          status: "aberta",
          customerCount: request.body.customerCount || 1,
          notes: request.body.notes,
          totalAmount: "0",
        })
        .returning();

      // Update table status to ocupada
      await app.db.update(schema.tables).set({ status: "ocupada" }).where(eq(schema.tables.id, request.body.tableId));

      app.logger.info({ orderId: created.id }, "Order created and table set to ocupada");
      return reply.status(201).send(created);
    }
  );

  // GET /api/orders/:id
  app.fastify.get<{ Params: { id: string } }>(
    "/api/orders/:id",
    {
      schema: {
        description: "Get order with all details",
        tags: ["orders"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              tableId: { type: "string", format: "uuid" },
              waiterId: { type: "string" },
              status: { type: "string" },
              customerCount: { type: "number" },
              notes: { type: "string" },
              openedAt: { type: "string", format: "date-time" },
              closedAt: { type: "string", format: "date-time" },
              totalAmount: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ orderId: request.params.id }, "Getting order details");

      const order = await app.db.query.orders.findFirst({
        where: eq(schema.orders.id, request.params.id),
      });

      if (!order) {
        app.logger.warn({ orderId: request.params.id }, "Order not found");
        return reply.status(404).send({ error: "Order not found" });
      }

      app.logger.info({ orderId: order.id }, "Order retrieved");
      return order;
    }
  );

  // PUT /api/orders/:id
  app.fastify.put<{ Params: { id: string }; Body: UpdateOrderBody }>(
    "/api/orders/:id",
    {
      schema: {
        description: "Update order",
        tags: ["orders"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["aberta", "fechando", "fechada", "cancelada"] },
            notes: { type: "string" },
            customerCount: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              tableId: { type: "string", format: "uuid" },
              waiterId: { type: "string" },
              status: { type: "string" },
              customerCount: { type: "number" },
              notes: { type: "string" },
              openedAt: { type: "string", format: "date-time" },
              closedAt: { type: "string", format: "date-time" },
              totalAmount: { type: "string" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateOrderBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ orderId: request.params.id, body: request.body }, "Updating order");

      const existing = await app.db.query.orders.findFirst({
        where: eq(schema.orders.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ orderId: request.params.id }, "Order not found");
        return reply.status(404).send({ error: "Order not found" });
      }

      const updates: any = {};
      if (request.body.status !== undefined) updates.status = request.body.status;
      if (request.body.notes !== undefined) updates.notes = request.body.notes;
      if (request.body.customerCount !== undefined) updates.customerCount = request.body.customerCount;

      // If status changes to fechada or cancelada, set table to livre and set closed_at
      if (request.body.status && (request.body.status === "fechada" || request.body.status === "cancelada")) {
        updates.closedAt = new Date();
        await app.db.update(schema.tables).set({ status: "livre" }).where(eq(schema.tables.id, existing.tableId));
      }

      // Recalculate total_amount
      const items = await app.db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, request.params.id));

      const totalAmount = items
        .filter((item) => item.status !== "cancelado")
        .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);

      updates.totalAmount = totalAmount.toString();

      const [updated] = await app.db
        .update(schema.orders)
        .set(updates)
        .where(eq(schema.orders.id, request.params.id))
        .returning();

      app.logger.info({ orderId: updated.id, newStatus: updated.status }, "Order updated");
      return updated;
    }
  );

  // DELETE /api/orders/:id
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/orders/:id",
    {
      schema: {
        description: "Cancel order",
        tags: ["orders"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: { type: "object", properties: { message: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ orderId: request.params.id }, "Cancelling order");

      const existing = await app.db.query.orders.findFirst({
        where: eq(schema.orders.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ orderId: request.params.id }, "Order not found");
        return reply.status(404).send({ error: "Order not found" });
      }

      await app.db
        .update(schema.orders)
        .set({ status: "cancelada", closedAt: new Date() })
        .where(eq(schema.orders.id, request.params.id));

      // Set table to livre
      await app.db.update(schema.tables).set({ status: "livre" }).where(eq(schema.tables.id, existing.tableId));

      app.logger.info({ orderId: request.params.id }, "Order cancelled");
      return { message: "Order cancelled" };
    }
  );
}
