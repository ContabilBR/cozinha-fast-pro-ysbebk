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
  status?: string;
  location?: string;
  active?: boolean;
}

export function registerTableRoutes(app: App) {
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
                status: { type: "string", enum: ["livre", "ocupada", "reservada"] },
                location: { type: "string" },
                active: { type: "boolean" },
                created_at: { type: "string", format: "date-time" },
                current_order_id: { type: "string", format: "uuid" },
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
        app.logger.info({}, "Listing tables");

        // Get all tables
        const allTables = await app.db
          .select()
          .from(schema.tables);

        // Map to response format (current_order_id not required for now)
        const result = allTables.map((table) => ({
          id: table.id,
          number: table.number,
          capacity: table.capacity,
          status: table.status,
          location: table.location,
          active: table.active,
          created_at: table.createdAt,
          current_order_id: null,
        }));

        app.logger.info({ count: result.length }, "Tables listed");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list tables");
        return reply.status(500).send({ error: "Internal server error" });
      }
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
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateTableBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      if (!request.body.number || !request.body.capacity) {
        return reply.status(400).send({ error: "number and capacity are required" });
      }

      try {
        app.logger.info(
          { number: request.body.number, capacity: request.body.capacity },
          "Creating table"
        );

        const tables = await app.db
          .insert(schema.tables)
          .values({
            number: request.body.number,
            capacity: request.body.capacity,
            status: "livre",
            location: request.body.location,
            active: true,
          })
          .returning();

        if (!tables || tables.length === 0) {
          app.logger.error({}, "Insert returned no rows");
          return reply.status(500).send({ error: "Failed to create table" });
        }

        const table = tables[0];
        app.logger.info({ tableId: table.id }, "Table created");

        return reply.status(201).send({
          id: table.id,
          number: table.number,
          capacity: table.capacity,
          status: table.status,
          location: table.location,
          active: table.active,
          created_at: table.createdAt,
          current_order_id: null,
        });
      } catch (error) {
        app.logger.error(
          { err: error, body: request.body },
          "Failed to create table"
        );
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/tables/:id
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
            status: { type: "string", enum: ["livre", "ocupada", "reservada"] },
            location: { type: "string" },
            active: { type: "boolean" },
          },
        },
        response: {
          200: { type: "object" },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateTableBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ tableId: request.params.id }, "Updating table");

        const existing = await app.db
          .select()
          .from(schema.tables)
          .where(eq(schema.tables.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
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

        return {
          id: updated.id,
          number: updated.number,
          capacity: updated.capacity,
          status: updated.status,
          location: updated.location,
          active: updated.active,
          created_at: updated.createdAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update table");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
