import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

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
          .select()
          .from(schema.tables)
          .where(eq(schema.tables.active, true))
          .orderBy(schema.tables.number);

        return tables.map((t) => ({
          id: t.id,
          number: t.number,
          capacity: t.capacity,
          location: t.location,
          status: t.status,
          active: t.active,
          created_at: t.createdAt,
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

        reply.status(201).send({
          id: table.id,
          number: table.number,
          capacity: table.capacity,
          location: table.location,
          status: table.status,
          active: table.active,
          created_at: table.createdAt,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to create table");
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

        return {
          id: updated.id,
          number: updated.number,
          capacity: updated.capacity,
          location: updated.location,
          status: updated.status,
          active: updated.active,
          created_at: updated.createdAt,
        };
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
