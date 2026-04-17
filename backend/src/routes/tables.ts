import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, ne, and } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface CreateMesaBody {
  numero: number;
  capacidade?: number;
  status?: string;
}

interface UpdateMesaBody {
  numero?: number;
  status?: string;
  capacidade?: number;
}

export function registerTableRoutes(app: App) {
  // GET /api/mesas - List all mesas
  app.fastify.get(
    "/api/mesas",
    {
      schema: {
        description: "List all mesas (requires authentication)",
        tags: ["mesas"],
        response: {
          200: {
            type: "object",
            properties: {
              mesas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    numero: { type: "number" },
                    status: { type: "string", enum: ["livre", "ocupada"] },
                    capacidade: { type: "number" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
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
        app.logger.info({}, "Listing mesas");
        const mesas = await app.db.select().from(schema.mesas).orderBy(schema.mesas.numero);

        return reply.code(200).send({
          mesas: mesas.map((m) => ({
            id: m.id,
            numero: m.numero,
            status: m.status,
            capacidade: m.capacidade,
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
        description: "Create a new mesa (requires authentication)",
        tags: ["mesas"],
        body: {
          type: "object",
          required: ["numero"],
          properties: {
            numero: { type: "number" },
            capacidade: { type: "number" },
            status: { type: "string", enum: ["livre", "ocupada"] },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              mesa: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  numero: { type: "number" },
                  status: { type: "string", enum: ["livre", "ocupada"] },
                  capacidade: { type: "number" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          409: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateMesaBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        if (!request.body.numero) {
          return reply.code(400).send({ error: "numero is required" });
        }

        app.logger.info({ numero: request.body.numero }, "Creating mesa");

        // Check for duplicate numero
        const existing = await app.db
          .select()
          .from(schema.mesas)
          .where(eq(schema.mesas.numero, request.body.numero))
          .limit(1);

        if (existing.length > 0) {
          return reply.code(409).send({ error: "Número de mesa já existe" });
        }

        const [mesa] = await app.db
          .insert(schema.mesas)
          .values({
            numero: request.body.numero as number,
            status: (request.body.status || "livre") as "livre" | "ocupada",
            capacidade: request.body.capacidade || 4,
          })
          .returning();

        app.logger.info({ mesaId: mesa.id }, "Mesa created successfully");

        return reply.code(201).send({
          mesa: {
            id: mesa.id,
            numero: mesa.numero,
            status: mesa.status,
            capacidade: mesa.capacidade,
            createdAt: mesa.createdAt.toISOString(),
          },
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
        description: "Get a mesa by ID (requires authentication)",
        tags: ["mesas"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              numero: { type: "number" },
              status: { type: "string", enum: ["livre", "ocupada"] },
              capacidade: { type: "number" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

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
          capacidade: mesa.capacidade,
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
        description: "Update a mesa (requires authentication)",
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
            status: { type: "string", enum: ["livre", "ocupada"] },
            capacidade: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              mesa: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  numero: { type: "number" },
                  status: { type: "string", enum: ["livre", "ocupada"] },
                  capacidade: { type: "number" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          409: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateMesaBody }>,
      reply: FastifyReply
    ) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ mesaId: request.params.id, body: request.body }, "Updating mesa");

        const existing = await app.db
          .select()
          .from(schema.mesas)
          .where(eq(schema.mesas.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Mesa not found" });
        }

        // Check for duplicate numero if being changed
        if (request.body.numero !== undefined) {
          const duplicateCheck = await app.db
            .select()
            .from(schema.mesas)
            .where(and(ne(schema.mesas.id, request.params.id), eq(schema.mesas.numero, request.body.numero)))
            .limit(1);

          if (duplicateCheck.length > 0) {
            return reply.code(409).send({ error: "Número de mesa já existe" });
          }
        }

        const updates: any = {};
        if (request.body.numero !== undefined) updates.numero = request.body.numero as number;
        if (request.body.status !== undefined) updates.status = request.body.status as "livre" | "ocupada";
        if (request.body.capacidade !== undefined) updates.capacidade = request.body.capacidade as number;

        const [updated] = await app.db
          .update(schema.mesas)
          .set(updates)
          .where(eq(schema.mesas.id, request.params.id))
          .returning();

        app.logger.info({ mesaId: updated.id }, "Mesa updated successfully");

        return reply.code(200).send({
          mesa: {
            id: updated.id,
            numero: updated.numero,
            status: updated.status,
            capacidade: updated.capacidade,
            createdAt: updated.createdAt.toISOString(),
          },
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update mesa");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/mesas/:id - Delete a mesa
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/mesas/:id",
    {
      schema: {
        description: "Delete a mesa (requires authentication and libre status)",
        tags: ["mesas"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "object",
            properties: { success: { type: "boolean" } },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ mesaId: request.params.id }, "Deleting mesa");

        const existing = await app.db
          .select()
          .from(schema.mesas)
          .where(eq(schema.mesas.id, request.params.id))
          .limit(1);

        if (!existing.length) {
          return reply.code(404).send({ error: "Mesa not found" });
        }

        const mesa = existing[0];
        if (mesa.status !== "livre") {
          return reply.code(400).send({ error: "Mesa não pode ser excluída pois não está livre" });
        }

        await app.db.delete(schema.mesas).where(eq(schema.mesas.id, request.params.id));

        app.logger.info({ mesaId: request.params.id }, "Mesa deleted successfully");

        return reply.code(200).send({ success: true });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete mesa");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
