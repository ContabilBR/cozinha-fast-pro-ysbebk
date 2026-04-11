import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

interface CreateTableBody {
  number: number;
  capacity?: number;
  location?: string;
}

interface UpdateTableBody {
  number?: number;
  capacity?: number;
  status?: "livre" | "ocupada" | "reservada" | "fechando";
  location?: string;
  active?: boolean;
}

export function registerTableRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/tables
  app.fastify.get(
    "/api/tables",
    {
      schema: {
        description: "List all tables with current order info",
        tags: ["tables"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                number: { type: "number" },
                capacity: { type: "number" },
                status: { type: "string", enum: ["livre", "ocupada", "reservada", "fechando"] },
                location: { type: "string" },
                active: { type: "boolean" },
                currentOrderId: { type: "string", format: "uuid" },
                createdAt: { type: "string", format: "date-time" },
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

      app.logger.info({}, "Listing tables");

      const tables = await app.db.select().from(schema.tables);

      const tablesWithOrders = await Promise.all(
        tables.map(async (table) => {
          const currentOrder = await app.db.query.orders.findFirst({
            where: eq(schema.orders.tableId, table.id),
          });

          return {
            ...table,
            currentOrderId: currentOrder?.id,
          };
        })
      );

      app.logger.info({ count: tablesWithOrders.length }, "Tables listed");
      return tablesWithOrders;
    }
  );

  // POST /api/tables
  app.fastify.post<{ Body: CreateTableBody }>(
    "/api/tables",
    {
      schema: {
        description: "Create a new table",
        tags: ["tables"],
        body: {
          type: "object",
          required: ["number"],
          properties: {
            number: { type: "number" },
            capacity: { type: "number" },
            location: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              number: { type: "number" },
              capacity: { type: "number" },
              status: { type: "string", enum: ["livre", "ocupada", "reservada", "fechando"] },
              location: { type: "string" },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateTableBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ number: request.body.number }, "Creating table");

      const [created] = await app.db
        .insert(schema.tables)
        .values({
          number: request.body.number,
          capacity: request.body.capacity || 4,
          location: request.body.location,
          status: "livre",
          active: true,
        })
        .returning();

      app.logger.info({ tableId: created.id }, "Table created");
      return reply.status(201).send(created);
    }
  );

  // PUT /api/tables/:id
  app.fastify.put<{ Params: { id: string }; Body: UpdateTableBody }>(
    "/api/tables/:id",
    {
      schema: {
        description: "Update table",
        tags: ["tables"],
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
            number: { type: "number" },
            capacity: { type: "number" },
            status: { type: "string", enum: ["livre", "ocupada", "reservada", "fechando"] },
            location: { type: "string" },
            active: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              number: { type: "number" },
              capacity: { type: "number" },
              status: { type: "string", enum: ["livre", "ocupada", "reservada", "fechando"] },
              location: { type: "string" },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateTableBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ tableId: request.params.id, body: request.body }, "Updating table");

      const existing = await app.db.query.tables.findFirst({
        where: eq(schema.tables.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ tableId: request.params.id }, "Table not found");
        return reply.status(404).send({ error: "Table not found" });
      }

      const updates: any = {};
      if (request.body.number !== undefined) updates.number = request.body.number;
      if (request.body.capacity !== undefined) updates.capacity = request.body.capacity;
      if (request.body.status !== undefined) updates.status = request.body.status;
      if (request.body.location !== undefined) updates.location = request.body.location;
      if (request.body.active !== undefined) updates.active = request.body.active;

      const [updated] = await app.db
        .update(schema.tables)
        .set(updates)
        .where(eq(schema.tables.id, request.params.id))
        .returning();

      app.logger.info({ tableId: updated.id }, "Table updated");
      return updated;
    }
  );

  // DELETE /api/tables/:id
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/tables/:id",
    {
      schema: {
        description: "Deactivate table (set active=false)",
        tags: ["tables"],
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

      app.logger.info({ tableId: request.params.id }, "Deactivating table");

      const existing = await app.db.query.tables.findFirst({
        where: eq(schema.tables.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ tableId: request.params.id }, "Table not found");
        return reply.status(404).send({ error: "Table not found" });
      }

      await app.db.update(schema.tables).set({ active: false }).where(eq(schema.tables.id, request.params.id));

      app.logger.info({ tableId: request.params.id }, "Table deactivated");
      return { message: "Table deactivated" };
    }
  );
}
