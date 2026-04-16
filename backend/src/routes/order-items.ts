import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface CreateOrderItemBody {
  dish_id: string;
  quantity?: number;
  notes?: string;
}

interface UpdateOrderItemBody {
  status?: string;
  notes?: string;
  quantity?: number;
}

export function registerOrderItemRoutes(app: App) {
  // POST /api/orders/:order_id/items
  app.fastify.post<{ Params: { order_id: string }; Body: CreateOrderItemBody }>(
    "/api/orders/:order_id/items",
    {
      schema: {
        description: "Add item to order",
        tags: ["order-items"],
        params: {
          type: "object",
          required: ["order_id"],
          properties: {
            order_id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["dish_id"],
          properties: {
            dish_id: { type: "string", format: "uuid" },
            quantity: { type: "number" },
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
    async (
      request: FastifyRequest<{ Params: { order_id: string }; Body: CreateOrderItemBody }>,
      reply: FastifyReply
    ) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      if (!request.body.dish_id) {
        return reply.status(400).send({ error: "dish_id is required" });
      }

      try {
        app.logger.info(
          { orderId: request.params.order_id, dishId: request.body.dish_id },
          "Adding item to order"
        );

        // Get dish to get price
        const dishes = await app.db
          .select()
          .from(schema.dishes)
          .where(eq(schema.dishes.id, request.body.dish_id))
          .limit(1);

        if (!dishes || dishes.length === 0) {
          return reply.status(400).send({ error: "Dish not found" });
        }

        const dish = dishes[0];

        const [created] = await app.db
          .insert(schema.orderItems)
          .values({
            orderId: request.params.order_id,
            dishId: request.body.dish_id,
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
          .where(eq(schema.orderItems.orderId, request.params.order_id));

        const totalAmount = items
          .filter((item) => item.status !== "cancelado")
          .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);

        await app.db
          .update(schema.orders)
          .set({ totalAmount: totalAmount.toString() })
          .where(eq(schema.orders.id, request.params.order_id));

        app.logger.info({ itemId: created.id }, "Item added to order");

        reply.code(201).send({
          id: created.id,
          order_id: created.orderId,
          dish_id: created.dishId,
          quantity: created.quantity,
          unit_price: created.unitPrice,
          notes: created.notes,
          status: created.status,
          requested_at: created.requestedAt,
          received_at: created.receivedAt,
          started_at: created.startedAt,
          ready_at: created.readyAt,
          delivered_at: created.deliveredAt,
          created_at: created.createdAt,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to add item to order");
        return reply.status(500).send({ error: "Internal server error" });
      }
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
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pendente", "recebido", "em_preparo", "pronto", "entregue", "cancelado"],
            },
            notes: { type: "string" },
            quantity: { type: "number" },
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
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateOrderItemBody }>,
      reply: FastifyReply
    ) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ itemId: request.params.id }, "Updating order item");

        const existing = await app.db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
          return reply.status(404).send({ error: "Order item not found" });
        }

        const existingItem = existing[0];
        const updates: any = {};
        if (request.body.notes !== undefined) updates.notes = request.body.notes;
        if (request.body.quantity !== undefined) updates.quantity = request.body.quantity;

        // Handle status change and set timestamps
        if (request.body.status !== undefined && request.body.status !== existingItem.status) {
          updates.status = request.body.status;

          if (request.body.status === "recebido") updates.receivedAt = new Date();
          else if (request.body.status === "em_preparo") updates.startedAt = new Date();
          else if (request.body.status === "pronto") updates.readyAt = new Date();
          else if (request.body.status === "entregue") updates.deliveredAt = new Date();

          // Log status change
          const dishes = await app.db
            .select()
            .from(schema.dishes)
            .where(eq(schema.dishes.id, existingItem.dishId))
            .limit(1);

          await app.db.insert(schema.actionLogs).values({
            userId: auth.userId,
            action: "item_status_change",
            entityType: "order_item",
            entityId: request.params.id,
            details: {
              oldStatus: existingItem.status,
              newStatus: request.body.status,
              dishName: dishes && dishes.length > 0 ? dishes[0].name : null,
            },
          });

          app.logger.info(
            {
              itemId: request.params.id,
              oldStatus: existingItem.status,
              newStatus: request.body.status,
            },
            "Order item status changed"
          );
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
          .where(eq(schema.orderItems.orderId, existingItem.orderId));

        const totalAmount = items
          .filter((item) => item.status !== "cancelado")
          .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);

        await app.db
          .update(schema.orders)
          .set({ totalAmount: totalAmount.toString() })
          .where(eq(schema.orders.id, existingItem.orderId));

        app.logger.info({ itemId: updated.id }, "Order item updated");

        return {
          id: updated.id,
          order_id: updated.orderId,
          dish_id: updated.dishId,
          quantity: updated.quantity,
          unit_price: updated.unitPrice,
          notes: updated.notes,
          status: updated.status,
          requested_at: updated.requestedAt,
          received_at: updated.receivedAt,
          started_at: updated.startedAt,
          ready_at: updated.readyAt,
          delivered_at: updated.deliveredAt,
          created_at: updated.createdAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update order item");
        return reply.status(500).send({ error: "Internal server error" });
      }
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
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ itemId: request.params.id }, "Cancelling order item");

        const existing = await app.db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
          return reply.status(404).send({ error: "Order item not found" });
        }

        const existingItem = existing[0];

        await app.db
          .update(schema.orderItems)
          .set({ status: "cancelado" })
          .where(eq(schema.orderItems.id, request.params.id));

        // Recalculate order total
        const items = await app.db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, existingItem.orderId));

        const totalAmount = items
          .filter((item) => item.status !== "cancelado")
          .reduce((sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0);

        await app.db
          .update(schema.orders)
          .set({ totalAmount: totalAmount.toString() })
          .where(eq(schema.orders.id, existingItem.orderId));

        app.logger.info({ itemId: request.params.id }, "Order item cancelled");
        return { success: true };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to cancel order item");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
