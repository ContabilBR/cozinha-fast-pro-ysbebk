import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth } from "../utils/auth.js";

interface CreateComandaBody {
  mesaId: string;
  garcomId?: string;
}

interface FecharComandaBody {
  total?: string;
}

export function registerOrderRoutes(app: App) {
  // GET /api/comandas - List all open comandas
  app.fastify.get(
    "/api/comandas",
    {
      schema: {
        description: "List all open comandas",
        tags: ["comandas"],
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
                    mesaId: { type: "string", format: "uuid" },
                    numero: { type: "number" },
                    garcomId: { type: "string" },
                    status: { type: "string" },
                    total: { type: "string" },
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
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({}, "Listing comandas");

        const comandas = await app.db
          .select({
            id: schema.comandas.id,
            mesaId: schema.comandas.mesaId,
            numero: schema.mesas.numero,
            garcomId: schema.comandas.garcomId,
            status: schema.comandas.status,
            total: schema.comandas.total,
            createdAt: schema.comandas.createdAt,
          })
          .from(schema.comandas)
          .leftJoin(schema.mesas, eq(schema.comandas.mesaId, schema.mesas.id));

        return reply.code(200).send({
          data: comandas.map((c) => ({
            id: c.id,
            mesaId: c.mesaId,
            numero: c.numero,
            garcomId: c.garcomId,
            status: c.status,
            total: c.total,
            createdAt: c.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list comandas");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/comandas - Create a new comanda
  app.fastify.post<{ Body: CreateComandaBody }>(
    "/api/comandas",
    {
      schema: {
        description: "Create a new comanda",
        tags: ["comandas"],
        body: {
          type: "object",
          required: ["mesaId"],
          properties: {
            mesaId: { type: "string", format: "uuid" },
            garcomId: { type: ["string", "null"] },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              mesaId: { type: "string" },
              garcomId: { type: ["string", "null"] },
              status: { type: "string" },
              total: { type: "string" },
              createdAt: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateComandaBody }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        if (!request.body.mesaId) {
          return reply.code(400).send({ error: "mesaId is required" });
        }

        app.logger.info({ mesaId: request.body.mesaId }, "Creating comanda");

        const [comanda] = await app.db
          .insert(schema.comandas)
          .values({
            mesaId: request.body.mesaId,
            garcomId: request.body.garcomId,
            status: "aberta",
            total: "0",
          })
          .returning();

        // Update mesa status to ocupada
        await app.db
          .update(schema.mesas)
          .set({ status: "ocupada" })
          .where(eq(schema.mesas.id, request.body.mesaId));

        app.logger.info({ comandaId: comanda.id }, "Comanda created successfully");

        return reply.code(201).send({
          id: comanda.id,
          mesaId: comanda.mesaId,
          garcomId: comanda.garcomId,
          status: comanda.status,
          total: comanda.total,
          createdAt: comanda.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create comanda");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/comandas/:id - Get a comanda by ID
  app.fastify.get<{ Params: { id: string } }>(
    "/api/comandas/:id",
    {
      schema: {
        description: "Get a comanda by ID",
        tags: ["comandas"],
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
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ comandaId: request.params.id }, "Getting comanda");

        const comandas = await app.db
          .select({
            id: schema.comandas.id,
            mesaId: schema.comandas.mesaId,
            numero: schema.mesas.numero,
            garcomId: schema.comandas.garcomId,
            status: schema.comandas.status,
            total: schema.comandas.total,
            createdAt: schema.comandas.createdAt,
          })
          .from(schema.comandas)
          .leftJoin(schema.mesas, eq(schema.comandas.mesaId, schema.mesas.id))
          .where(eq(schema.comandas.id, request.params.id));

        if (!comandas.length) {
          return reply.code(404).send({ error: "Comanda not found" });
        }

        const c = comandas[0];
        return reply.code(200).send({
          id: c.id,
          mesaId: c.mesaId,
          numero: c.numero,
          garcomId: c.garcomId,
          status: c.status,
          total: c.total,
          createdAt: c.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get comanda");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/comandas/:id/fechar - Close a comanda
  app.fastify.put<{ Params: { id: string }; Body: FecharComandaBody }>(
    "/api/comandas/:id/fechar",
    {
      schema: {
        description: "Close a comanda",
        tags: ["comandas"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            total: { type: "string" },
          },
        },
        response: {
          200: { type: "object" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: FecharComandaBody }>,
      reply: FastifyReply
    ) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ comandaId: request.params.id }, "Closing comanda");

        const existing = await app.db
          .select()
          .from(schema.comandas)
          .where(eq(schema.comandas.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Comanda not found" });
        }

        // Calculate total from pedidos if not provided
        let total = request.body.total || "0";
        if (!request.body.total) {
          const pedidos = await app.db
            .select()
            .from(schema.pedidos)
            .where(eq(schema.pedidos.comandaId, request.params.id));

          const calculatedTotal = pedidos.reduce((sum, p) => {
            return sum + parseFloat(p.precoUnitario) * p.quantidade;
          }, 0);
          total = calculatedTotal.toFixed(2);
        }

        const [updated] = await app.db
          .update(schema.comandas)
          .set({
            status: "fechada",
            total,
            closedAt: new Date(),
          })
          .where(eq(schema.comandas.id, request.params.id))
          .returning();

        // Update mesa status back to livre
        await app.db
          .update(schema.mesas)
          .set({ status: "livre" })
          .where(eq(schema.mesas.id, updated.mesaId));

        app.logger.info({ comandaId: updated.id }, "Comanda closed successfully");

        return reply.code(200).send({
          id: updated.id,
          mesaId: updated.mesaId,
          garcomId: updated.garcomId,
          status: updated.status,
          total: updated.total,
          closedAt: updated.closedAt?.toISOString(),
          createdAt: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to close comanda");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/comandas/:id/cancelar - Cancel a comanda
  app.fastify.put<{ Params: { id: string } }>(
    "/api/comandas/:id/cancelar",
    {
      schema: {
        description: "Cancel a comanda",
        tags: ["comandas"],
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
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ comandaId: request.params.id }, "Canceling comanda");

        const existing = await app.db
          .select()
          .from(schema.comandas)
          .where(eq(schema.comandas.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Comanda not found" });
        }

        const [updated] = await app.db
          .update(schema.comandas)
          .set({
            status: "cancelada",
            closedAt: new Date(),
          })
          .where(eq(schema.comandas.id, request.params.id))
          .returning();

        // Update mesa status back to livre
        await app.db
          .update(schema.mesas)
          .set({ status: "livre" })
          .where(eq(schema.mesas.id, updated.mesaId));

        app.logger.info({ comandaId: updated.id }, "Comanda cancelled successfully");

        return reply.code(200).send({
          id: updated.id,
          mesaId: updated.mesaId,
          garcomId: updated.garcomId,
          status: updated.status,
          total: updated.total,
          closedAt: updated.closedAt?.toISOString(),
          createdAt: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to cancel comanda");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
