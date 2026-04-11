import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface KitchenQueueItem {
  item_id: string;
  order_id: string;
  table_number: number;
  waiter_name: string;
  dish_name: string;
  dish_image_url?: string;
  quantity: number;
  notes?: string;
  status: string;
  requested_at: Date;
  started_at?: Date;
}

interface UpdateItemStatusBody {
  status: string;
}

export function registerKitchenRoutes(app: App) {
  // GET /api/kitchen/queue
  app.fastify.get(
    "/api/kitchen/queue",
    {
      schema: {
        description: "Get kitchen queue with pending/received/in-prep items",
        tags: ["kitchen"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_id: { type: "string", format: "uuid" },
                order_id: { type: "string", format: "uuid" },
                table_number: { type: "number" },
                waiter_name: { type: "string" },
                dish_name: { type: "string" },
                dish_image_url: { type: "string" },
                quantity: { type: "number" },
                notes: { type: "string" },
                status: { type: "string" },
                requested_at: { type: "string", format: "date-time" },
                started_at: { type: "string", format: "date-time" },
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
        app.logger.info({}, "Fetching kitchen queue");

        // Get all items with status IN ('pendente', 'recebido', 'em_preparo')
        const items = await app.db
          .select()
          .from(schema.orderItems)
          .leftJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
          .leftJoin(schema.dishes, eq(schema.orderItems.dishId, schema.dishes.id))
          .leftJoin(user, eq(schema.orders.waiterId, user.id))
          .where(inArray(schema.orderItems.status, ["pendente", "recebido", "em_preparo"]));

        const result = items.map((row) => ({
          item_id: row.order_items.id,
          order_id: row.order_items.orderId,
          table_number: row.tables ? row.tables.number : 0,
          waiter_name: row.user ? row.user.name : "Unknown",
          dish_name: row.dishes ? row.dishes.name : "Unknown",
          dish_image_url: row.dishes ? row.dishes.imageUrl : undefined,
          quantity: row.order_items.quantity,
          notes: row.order_items.notes,
          status: row.order_items.status,
          requested_at: row.order_items.requestedAt,
          started_at: row.order_items.startedAt || undefined,
        }));

        // Sort by requestedAt ASC
        result.sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime());

        app.logger.info({ count: result.length }, "Kitchen queue fetched");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to fetch kitchen queue");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/kitchen/items/:id/status
  app.fastify.put<{ Params: { id: string }; Body: UpdateItemStatusBody }>(
    "/api/kitchen/items/:id/status",
    {
      schema: {
        description: "Update kitchen item status",
        tags: ["kitchen"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["pendente", "recebido", "em_preparo", "pronto", "entregue", "cancelado"],
            },
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
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateItemStatusBody }>,
      reply: FastifyReply
    ) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ itemId: request.params.id, newStatus: request.body.status }, "Updating kitchen item status");

        const existing = await app.db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
          return reply.status(404).send({ error: "Order item not found" });
        }

        const existingItem = existing[0];
        const updates: any = { status: request.body.status };

        // Set appropriate timestamp based on status
        if (request.body.status === "recebido") updates.receivedAt = new Date();
        else if (request.body.status === "em_preparo") updates.startedAt = new Date();
        else if (request.body.status === "pronto") updates.readyAt = new Date();
        else if (request.body.status === "entregue") updates.deliveredAt = new Date();

        const [updated] = await app.db
          .update(schema.orderItems)
          .set(updates)
          .where(eq(schema.orderItems.id, request.params.id))
          .returning();

        // Log action
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

        app.logger.info({ itemId: updated.id, newStatus: updated.status }, "Kitchen item status updated");

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
        app.logger.error({ err: error }, "Failed to update kitchen item status");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
