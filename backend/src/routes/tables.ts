import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

interface CreateMesaBody {
  numero: number;
}

interface UpdateMesaBody {
  numero?: number;
  status?: string;
}

export function registerTableRoutes(app: App) {
  // GET /api/mesas - List all mesas
  app.fastify.get(
    "/api/mesas",
    {
      schema: {
        description: "List all mesas",
        tags: ["mesas"],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    numero: { type: "number" },
                    status: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing mesas");
        const mesas = await app.db.select().from(schema.mesas).orderBy(schema.mesas.numero);

        return reply.code(200).send({
          data: mesas.map((m) => ({
            id: m.id,
            numero: m.numero,
            status: m.status,
            createdAt: m.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list mesas");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/mesas - Create a new mesa
  app.fastify.post<{ Body: CreateMesaBody }>(
    "/api/mesas",
    {
      schema: {
        description: "Create a new mesa",
        tags: ["mesas"],
        body: {
          type: "object",
          required: ["numero"],
          properties: {
            numero: { type: "number" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              numero: { type: "number" },
              status: { type: "string" },
              createdAt: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateMesaBody }>, reply: FastifyReply) => {
      try {
        if (!request.body.numero) {
          return reply.code(400).send({ error: "numero is required" });
        }

        app.logger.info({ numero: request.body.numero }, "Creating mesa");

        const [mesa] = await app.db
          .insert(schema.mesas)
          .values({
            numero: request.body.numero,
            status: "disponivel",
          })
          .returning();

        app.logger.info({ mesaId: mesa.id }, "Mesa created successfully");

        return reply.code(201).send({
          id: mesa.id,
          numero: mesa.numero,
          status: mesa.status,
          createdAt: mesa.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create mesa");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/mesas/:id - Get a mesa
  app.fastify.get<{ Params: { id: string } }>(
    "/api/mesas/:id",
    {
      schema: {
        description: "Get a mesa by ID",
        tags: ["mesas"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: { type: "object" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        app.logger.info({ mesaId: request.params.id }, "Getting mesa");

        const mesas = await app.db
          .select()
          .from(schema.mesas)
          .where(eq(schema.mesas.id, request.params.id));

        if (!mesas.length) {
          return reply.code(404).send({ error: "Mesa not found" });
        }

        const mesa = mesas[0];
        return reply.code(200).send({
          id: mesa.id,
          numero: mesa.numero,
          status: mesa.status,
          createdAt: mesa.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get mesa");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/mesas/:id - Update a mesa
  app.fastify.put<{ Params: { id: string }; Body: UpdateMesaBody }>(
    "/api/mesas/:id",
    {
      schema: {
        description: "Update a mesa",
        tags: ["mesas"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            numero: { type: "number" },
            status: { type: "string", enum: ["disponivel", "ocupada", "reservada"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              numero: { type: "number" },
              status: { type: "string" },
              createdAt: { type: "string" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateMesaBody }>,
      reply: FastifyReply
    ) => {
      try {
        app.logger.info({ mesaId: request.params.id, body: request.body }, "Updating mesa");

        const existing = await app.db
          .select()
          .from(schema.mesas)
          .where(eq(schema.mesas.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Mesa not found" });
        }

        const updates: any = {};
        if (request.body.numero !== undefined) updates.numero = request.body.numero;
        if (request.body.status !== undefined) updates.status = request.body.status;

        const [updated] = await app.db
          .update(schema.mesas)
          .set(updates)
          .where(eq(schema.mesas.id, request.params.id))
          .returning();

        app.logger.info({ mesaId: updated.id }, "Mesa updated successfully");

        return reply.code(200).send({
          id: updated.id,
          numero: updated.numero,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update mesa");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
