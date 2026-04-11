import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, inArray, and } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

interface KitchenQueueItem {
  itemId: string;
  orderId: string;
  tableNumber: number;
  waiterName: string;
  dishName: string;
  dishImageUrl?: string;
  quantity: number;
  notes?: string;
  status: string;
  requestedAt: Date;
  startedAt?: Date;
}

interface UpdateItemStatusBody {
  status: "pendente" | "recebido" | "em_preparo" | "pronto" | "entregue" | "cancelado";
}

export function registerKitchenRoutes(app: App) {
  const requireAuth = app.requireAuth();

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
                itemId: { type: "string", format: "uuid" },
                orderId: { type: "string", format: "uuid" },
                tableNumber: { type: "number" },
                waiterName: { type: "string" },
                dishName: { type: "string" },
                dishImageUrl: { type: "string" },
                quantity: { type: "number" },
                notes: { type: "string" },
                status: { type: "string" },
                requestedAt: { type: "string", format: "date-time" },
                startedAt: { type: "string", format: "date-time" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, "Fetching kitchen queue");

      // Get all items with status IN ('pendente', 'recebido', 'em_preparo')
      const items = await app.db
        .select()
        .from(schema.orderItems)
        .where(inArray(schema.orderItems.status, ["pendente", "recebido", "em_preparo"]));

      // Enrich with order, table, dish, and waiter data
      const enrichedItems: KitchenQueueItem[] = await Promise.all(
        items.map(async (item) => {
          const order = await app.db.query.orders.findFirst({
            where: eq(schema.orders.id, item.orderId),
          });

          const table = order
            ? await app.db.query.tables.findFirst({
                where: eq(schema.tables.id, order.tableId),
              })
            : null;

          const dish = await app.db.query.dishes.findFirst({
            where: eq(schema.dishes.id, item.dishId),
          });

          const waiter = order
            ? await app.db.query.user.findFirst({
                where: eq(userTable.id, order.waiterId),
              })
            : null;

          return {
            itemId: item.id,
            orderId: item.orderId,
            tableNumber: table?.number || 0,
            waiterName: waiter?.name || "Unknown",
            dishName: dish?.name || "Unknown",
            dishImageUrl: dish?.imageUrl,
            quantity: item.quantity,
            notes: item.notes,
            status: item.status,
            requestedAt: item.requestedAt,
            startedAt: item.startedAt || undefined,
          };
        })
      );

      // Sort by requestedAt ASC
      enrichedItems.sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());

      app.logger.info({ count: enrichedItems.length }, "Kitchen queue fetched");
      return enrichedItems;
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
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["pendente", "recebido", "em_preparo", "pronto", "entregue", "cancelado"] },
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
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateItemStatusBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ itemId: request.params.id, newStatus: request.body.status }, "Updating kitchen item status");

      const existing = await app.db.query.orderItems.findFirst({
        where: eq(schema.orderItems.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ itemId: request.params.id }, "Order item not found");
        return reply.status(404).send({ error: "Order item not found" });
      }

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

      app.logger.info({ itemId: updated.id, newStatus: updated.status }, "Kitchen item status updated");
      return updated;
    }
  );
}
