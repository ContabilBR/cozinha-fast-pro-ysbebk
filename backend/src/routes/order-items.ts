import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

interface CreateOrderItemBody {
  dishId: string;
  quantity?: number;
  notes?: string;
}

interface UpdateOrderItemBody {
  status?: "pendente" | "recebido" | "em_preparo" | "pronto" | "entregue" | "cancelado";
  notes?: string;
  quantity?: number;
}

export function registerOrderItemRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/orders/:orderId/items
  app.fastify.get<{ Params: { orderId: string } }>(
    "/api/orders/:orderId/items",
    {
      schema: {
        description: "List items for an order",
        tags: ["order-items"],
        params: {
          type: "object",
          required: ["orderId"],
          properties: {
            orderId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                orderId: { type: "string", format: "uuid" },
                dishId: { type: "string", format: "uuid" },
                quantity: { type: "number" },
                unitPrice: { type: "string" },
                notes: { type: "string" },
                status: { type: "string" },
                requestedAt: { type: "string", format: "date-time" },
                receivedAt: { type: "string", format: "date-time" },
                startedAt: { type: "string", format: "date-time" },
                readyAt: { type: "string", format: "date-time" },
                deliveredAt: { type: "string", format: "date-time" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { orderId: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ orderId: request.params.orderId }, "Listing order items");

      const items = await app.db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, request.params.orderId));

      app.logger.info({ count: items.length }, "Order items listed");
      return items;
    }
  );

  // POST /api/orders/:orderId/items
  app.fastify.post<{ Params: { orderId: string }; Body: CreateOrderItemBody }>(
    "/api/orders/:orderId/items",
    {
      schema: {
        description: "Add item to order",
        tags: ["order-items"],
        params: {
          type: "object",
          required: ["orderId"],
          properties: {
            orderId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["dishId"],
          properties: {
            dishId: { type: "string", format: "uuid" },
            quantity: { type: "number" },
            notes: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              orderId: { type: "string", format: "uuid" },
              dishId: { type: "string", format: "uuid" },
              quantity: { type: "number" },
              unitPrice: { type: "string" },
              notes: { type: "string" },
              status: { type: "string" },
              requestedAt: { type: "string", format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { orderId: string }; Body: CreateOrderItemBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ orderId: request.params.orderId, dishId: request.body.dishId }, "Adding item to order");

      // Get dish to get price
      const dish = await app.db.query.dishes.findFirst({
        where: eq(schema.dishes.id, request.body.dishId),
      });

      if (!dish) {
        app.logger.warn({ dishId: request.body.dishId }, "Dish not found");
        return reply.status(400).send({ error: "Dish not found" });
      }

      const [created] = await app.db
        .insert(schema.orderItems)
        .values({
          orderId: request.params.orderId,
          dishId: request.body.dishId,
          quantity: request.body.quantity || 1,
          unitPrice: dish.price,
          notes: request.body.notes,
          status: "pendente",
        })
        .returning();

      // Recalculate order total
      const items = await app.db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, request.params.orderId));

      const totalAmount = items
        .filter((item) => item.status !== "cancelado")
        .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);

      await app.db
        .update(schema.orders)
        .set({ totalAmount: totalAmount.toString() })
        .where(eq(schema.orders.id, request.params.orderId));

      app.logger.info({ itemId: created.id }, "Item added to order");
      return reply.status(201).send(created);
    }
  );

  // PUT /api/order-items/:id
  app.fastify.put<{ Params: { id: string }; Body: UpdateOrderItemBody }>(
    "/api/order-items/:id",
    {
      schema: {
        description: "Update order item",
        tags: ["order-items"],
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
            status: { type: "string", enum: ["pendente", "recebido", "em_preparo", "pronto", "entregue", "cancelado"] },
            notes: { type: "string" },
            quantity: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              orderId: { type: "string", format: "uuid" },
              dishId: { type: "string", format: "uuid" },
              quantity: { type: "number" },
              unitPrice: { type: "string" },
              notes: { type: "string" },
              status: { type: "string" },
              requestedAt: { type: "string", format: "date-time" },
              receivedAt: { type: "string", format: "date-time" },
              startedAt: { type: "string", format: "date-time" },
              readyAt: { type: "string", format: "date-time" },
              deliveredAt: { type: "string", format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateOrderItemBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ itemId: request.params.id, body: request.body }, "Updating order item");

      const existing = await app.db.query.orderItems.findFirst({
        where: eq(schema.orderItems.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ itemId: request.params.id }, "Order item not found");
        return reply.status(404).send({ error: "Order item not found" });
      }

      const updates: any = {};
      if (request.body.notes !== undefined) updates.notes = request.body.notes;
      if (request.body.quantity !== undefined) updates.quantity = request.body.quantity;

      // Handle status change and set timestamps
      if (request.body.status !== undefined && request.body.status !== existing.status) {
        updates.status = request.body.status;

        if (request.body.status === "recebido") updates.receivedAt = new Date();
        else if (request.body.status === "em_preparo") updates.startedAt = new Date();
        else if (request.body.status === "pronto") updates.readyAt = new Date();
        else if (request.body.status === "entregue") updates.deliveredAt = new Date();

        // Log status change
        const dish = await app.db.query.dishes.findFirst({
          where: eq(schema.dishes.id, existing.dishId),
        });

        await app.db.insert(schema.actionLogs).values({
          userId: session.user.id,
          action: "item_status_change",
          entityType: "order_item",
          entityId: request.params.id,
          details: {
            oldStatus: existing.status,
            newStatus: request.body.status,
            dishName: dish?.name,
          },
        });

        app.logger.info({ itemId: request.params.id, oldStatus: existing.status, newStatus: request.body.status }, "Order item status changed");
      }

      const [updated] = await app.db
        .update(schema.orderItems)
        .set(updates)
        .where(eq(schema.orderItems.id, request.params.id))
        .returning();

      // Recalculate order total
      const items = await app.db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, existing.orderId));

      const totalAmount = items
        .filter((item) => item.status !== "cancelado")
        .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);

      await app.db
        .update(schema.orders)
        .set({ totalAmount: totalAmount.toString() })
        .where(eq(schema.orders.id, existing.orderId));

      app.logger.info({ itemId: updated.id }, "Order item updated");
      return updated;
    }
  );

  // DELETE /api/order-items/:id
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/order-items/:id",
    {
      schema: {
        description: "Cancel order item",
        tags: ["order-items"],
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

      app.logger.info({ itemId: request.params.id }, "Cancelling order item");

      const existing = await app.db.query.orderItems.findFirst({
        where: eq(schema.orderItems.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ itemId: request.params.id }, "Order item not found");
        return reply.status(404).send({ error: "Order item not found" });
      }

      await app.db
        .update(schema.orderItems)
        .set({ status: "cancelado" })
        .where(eq(schema.orderItems.id, request.params.id));

      // Recalculate order total
      const items = await app.db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, existing.orderId));

      const totalAmount = items
        .filter((item) => item.status !== "cancelado")
        .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);

      await app.db
        .update(schema.orders)
        .set({ totalAmount: totalAmount.toString() })
        .where(eq(schema.orders.id, existing.orderId));

      app.logger.info({ itemId: request.params.id }, "Order item cancelled");
      return { message: "Order item cancelled" };
    }
  );
}
