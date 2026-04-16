import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

interface UpdateKitchenItemBody {
  status?: string;
}

export function registerKitchenRoutes(app: App) {
  // GET /api/kitchen/items - Get kitchen queue
  app.fastify.get(
    "/api/kitchen/items",
    {
      schema: {
        description: "Get kitchen queue with pending/preparing items",
        tags: ["kitchen"],
        response: {
          200: {
            type: "array",
            items: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Fetching kitchen queue");

        const items = await app.db
          .select({
            item_id: schema.orderItems.id,
            order_id: schema.orderItems.orderId,
            dish_id: schema.orderItems.dishId,
            dish_name: schema.dishes.name,
            prep_time_minutes: schema.dishes.prepTimeMinutes,
            quantity: schema.orderItems.quantity,
            notes: schema.orderItems.notes,
            status: schema.orderItems.status,
            requested_at: schema.orderItems.requestedAt,
            started_at: schema.orderItems.startedAt,
            table_number: schema.tables.number,
          })
          .from(schema.orderItems)
          .leftJoin(schema.dishes, eq(schema.orderItems.dishId, schema.dishes.id))
          .leftJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
          .where(inArray(schema.orderItems.status, ["pendente", "recebido", "em_preparo"]));

        const result = items.map((row) => ({
          id: row.item_id,
          order_id: row.order_id,
          dish_id: row.dish_id,
          dish_name: row.dish_name,
          prep_time_minutes: row.prep_time_minutes,
          quantity: row.quantity,
          notes: row.notes,
          status: row.status,
          requested_at: row.requested_at,
          started_at: row.started_at,
          table_number: row.table_number,
        }));

        app.logger.info({ count: result.length }, "Kitchen queue fetched");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to fetch kitchen queue");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/kitchen/items/:id - Update kitchen item status
  app.fastify.put<{ Params: { id: string }; Body: UpdateKitchenItemBody }>(
    "/api/kitchen/items/:id",
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
          properties: {
            status: { type: "string", enum: ["pendente", "recebido", "em_preparo", "pronto", "entregue", "cancelado"] },
          },
        },
        response: {
          200: { type: "object" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateKitchenItemBody }>, reply: FastifyReply) => {
      try {
        app.logger.info({ itemId: request.params.id }, "Updating kitchen item status");

        const existing = await app.db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.id, request.params.id));

        if (!existing.length) {
          return reply.status(404).send({ error: "Order item not found" });
        }

        const updates: any = {};
        if (request.body.status !== undefined) {
          updates.status = request.body.status;
          // Set timestamps based on status
          if (request.body.status === "em_preparo") {
            updates.startedAt = new Date();
          } else if (request.body.status === "pronto") {
            updates.readyAt = new Date();
          } else if (request.body.status === "entregue") {
            updates.deliveredAt = new Date();
          }
        }

        const [updated] = await app.db
          .update(schema.orderItems)
          .set(updates)
          .where(eq(schema.orderItems.id, request.params.id))
          .returning();

        app.logger.info({ itemId: updated.id, status: updated.status }, "Kitchen item updated");

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
        app.logger.error({ err: error }, "Failed to update kitchen item");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
