import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface CreateTableBody {
  number: number;
  capacity: number;
  location?: string;
}

interface UpdateTableBody {
  number?: number;
  capacity?: number;
  location?: string;
  status?: string;
  active?: boolean;
}

export function registerTableRoutes(app: App) {
  // GET /api/tables - List all active tables
  app.fastify.get(
    "/api/tables",
    {
      schema: {
        description: "List all active tables",
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
                location: { type: "string" },
                status: { type: "string", enum: ["livre", "ocupada", "reservada", "fechando"] },
                active: { type: "boolean" },
                created_at: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing active tables");

        const tables = await app.db
          .select({
            id: schema.tables.id,
            number: schema.tables.number,
            capacity: schema.tables.capacity,
            location: schema.tables.location,
            status: schema.tables.status,
            active: schema.tables.active,
            created_at: schema.tables.createdAt,
            current_order_id: schema.orders.id,
          })
          .from(schema.tables)
          .leftJoin(schema.orders, and(
            eq(schema.tables.id, schema.orders.tableId),
            eq(schema.orders.status, 'aberta')
          ))
          .where(eq(schema.tables.active, true))
          .orderBy(schema.tables.number);

        return tables.map((t) => ({
          id: t.id,
          number: t.number,
          capacity: t.capacity,
          location: t.location,
          status: t.status,
          active: t.active,
          created_at: t.created_at.toISOString(),
          current_order_id: t.current_order_id || null,
        }));
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list tables");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/tables - Create a new table
  app.fastify.post<{ Body: CreateTableBody }>(
    "/api/tables",
    {
      schema: {
        description: "Create a new table",
        tags: ["tables"],
        body: {
          type: "object",
          required: ["number", "capacity"],
          properties: {
            number: { type: "number" },
            capacity: { type: "number" },
            location: { type: "string" },
          },
        },
        response: {
          201: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateTableBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        if (!request.body.number || !request.body.capacity) {
          return reply.status(400).send({ error: "number and capacity are required" });
        }

        app.logger.info({ number: request.body.number }, "Creating table");

        const [table] = await app.db
          .insert(schema.tables)
          .values({
            number: request.body.number,
            capacity: request.body.capacity,
            location: request.body.location,
            status: "livre",
            active: true,
          })
          .returning();

        app.logger.info({ tableId: table.id }, "Table created");

        return reply.status(201).send({
          id: table.id,
          number: table.number,
          capacity: table.capacity,
          location: table.location,
          status: table.status,
          active: table.active,
          created_at: table.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to create table");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/tables/:id - Get a table with current order
  app.fastify.get<{ Params: { id: string } }>(
    "/api/tables/:id",
    {
      schema: {
        description: "Get a table by ID",
        tags: ["tables"],
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
        app.logger.info({ tableId: request.params.id }, "Getting table");

        const rows = await app.db
          .select({
            id: schema.tables.id,
            number: schema.tables.number,
            capacity: schema.tables.capacity,
            location: schema.tables.location,
            status: schema.tables.status,
            active: schema.tables.active,
            created_at: schema.tables.createdAt,
            current_order_id: schema.orders.id,
          })
          .from(schema.tables)
          .leftJoin(schema.orders, and(
            eq(schema.tables.id, schema.orders.tableId),
            eq(schema.orders.status, 'aberta')
          ))
          .where(eq(schema.tables.id, request.params.id))
          .limit(1);

        if (!rows || rows.length === 0) {
          return reply.status(404).send({ error: "Table not found" });
        }

        const row = rows[0];
        return reply.status(200).send({
          id: row.id,
          number: row.number,
          capacity: row.capacity,
          location: row.location,
          status: row.status,
          active: row.active,
          created_at: row.created_at.toISOString(),
          current_order_id: row.current_order_id || null,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get table");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/tables/:id - Update a table
  app.fastify.put<{ Params: { id: string }; Body: UpdateTableBody }>(
    "/api/tables/:id",
    {
      schema: {
        description: "Update a table",
        tags: ["tables"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            number: { type: "number" },
            capacity: { type: "number" },
            location: { type: "string" },
            status: { type: "string", enum: ["livre", "ocupada", "reservada", "fechando"] },
            active: { type: "boolean" },
          },
        },
        response: {
          200: { type: "object" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateTableBody }>,
      reply: FastifyReply
    ) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ tableId: request.params.id }, "Updating table");

        const existing = await app.db
          .select()
          .from(schema.tables)
          .where(eq(schema.tables.id, request.params.id));

        if (!existing.length) {
          return reply.status(404).send({ error: "Table not found" });
        }

        const updates: any = {};
        if (request.body.number !== undefined) updates.number = request.body.number;
        if (request.body.capacity !== undefined) updates.capacity = request.body.capacity;
        if (request.body.location !== undefined) updates.location = request.body.location;
        if (request.body.status !== undefined) updates.status = request.body.status;
        if (request.body.active !== undefined) updates.active = request.body.active;

        const [updated] = await app.db
          .update(schema.tables)
          .set(updates)
          .where(eq(schema.tables.id, request.params.id))
          .returning();

        app.logger.info({ tableId: updated.id }, "Table updated");

        return reply.status(200).send({
          id: updated.id,
          number: updated.number,
          capacity: updated.capacity,
          location: updated.location,
          status: updated.status,
          active: updated.active,
          created_at: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update table");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/tables/:id - Delete (deactivate) a table
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/tables/:id",
    {
      schema: {
        description: "Delete a table",
        tags: ["tables"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          204: { description: "Table deleted" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ tableId: request.params.id }, "Deleting table");

        const existing = await app.db
          .select()
          .from(schema.tables)
          .where(eq(schema.tables.id, request.params.id));

        if (!existing.length) {
          return reply.status(404).send({ error: "Table not found" });
        }

        await app.db
          .update(schema.tables)
          .set({ active: false })
          .where(eq(schema.tables.id, request.params.id));

        app.logger.info({ tableId: request.params.id }, "Table deleted");

        return reply.status(204).send();
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete table");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
