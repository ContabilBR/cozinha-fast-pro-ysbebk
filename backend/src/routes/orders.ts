import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth } from "../utils/auth.js";

interface CreateComandaBody {
  mesaId?: string;
  mesa_id?: string;
  garcomId?: string;
  garcom_id?: string;
}

interface FecharComandaBody {
  total?: string;
}

export function registerOrderRoutes(app: App) {
  // GET /api/comandas - List all comandas with mesa and items count
  app.fastify.get<{ Querystring: { status?: string } }>(
    "/api/comandas",
    {
      schema: {
        description: "List all comandas",
        tags: ["comandas"],
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["aberta", "fechada", "cancelada"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              comandas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    mesa: { type: "number" },
                    status: { type: "string" },
                    total: { type: "string" },
                    items_count: { type: "number" },
                    opened_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ status: request.query.status }, "Listing comandas");

        // Get all comandas
        const allComandas = await app.db
          .select({
            id: schema.comandas.id,
            numero: schema.mesas.numero,
            status: schema.comandas.status,
            total: schema.comandas.total,
            createdAt: schema.comandas.createdAt,
          })
          .from(schema.comandas)
          .leftJoin(schema.mesas, eq(schema.comandas.mesaId, schema.mesas.id));

        // Filter by status if provided
        const comandas = request.query.status
          ? allComandas.filter((c) => c.status === request.query.status)
          : allComandas;

        // For each comanda, count pedidos
        const comandasWithCount = await Promise.all(
          comandas.map(async (c) => {
            const pedidosCount = await app.db
              .select()
              .from(schema.pedidos)
              .where(eq(schema.pedidos.comandaId, c.id));
            return {
              ...c,
              itemsCount: pedidosCount.length,
            };
          })
        );

        return reply.code(200).send({
          comandas: comandasWithCount.map((c) => ({
            id: c.id,
            mesa: c.numero,
            status: c.status,
            total: c.total,
            items_count: c.itemsCount,
            opened_at: c.createdAt.toISOString(),
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
          properties: {
            mesa_id: { type: ["string", "null"], format: "uuid" },
            mesaId: { type: ["string", "null"], format: "uuid" },
            garcom_id: { type: ["string", "null"] },
            garcomId: { type: ["string", "null"] },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              comanda: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  mesa_id: { type: "string" },
                  garcom_id: { type: ["string", "null"] },
                  status: { type: "string" },
                  total: { type: "string" },
                  created_at: { type: "string" },
                },
              },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateComandaBody }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        const mesaId = request.body.mesa_id || request.body.mesaId;
        const garcomId = request.body.garcom_id || request.body.garcomId;

        if (!mesaId) {
          return reply.code(400).send({ error: "mesa_id is required" });
        }

        // Check if mesa exists
        const mesa = await app.db
          .select()
          .from(schema.mesas)
          .where(eq(schema.mesas.id, mesaId))
          .limit(1);

        if (!mesa.length) {
          return reply.code(404).send({ error: "Mesa not found" });
        }

        app.logger.info({ mesaId }, "Creating comanda");

        const [comanda] = await app.db
          .insert(schema.comandas)
          .values({
            mesaId,
            garcomId,
            status: "aberta",
            total: "0",
          })
          .returning();

        // Update mesa status to ocupada
        await app.db
          .update(schema.mesas)
          .set({ status: "ocupada" })
          .where(eq(schema.mesas.id, mesaId));

        app.logger.info({ comandaId: comanda.id }, "Comanda created successfully");

        return reply.code(201).send({
          comanda: {
            id: comanda.id,
            mesa_id: comanda.mesaId,
            garcom_id: comanda.garcomId,
            status: comanda.status,
            total: comanda.total,
            created_at: comanda.createdAt.toISOString(),
          },
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create comanda");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/comandas/:id - Get a comanda by ID with full relations
  app.fastify.get<{ Params: { id: string } }>(
    "/api/comandas/:id",
    {
      schema: {
        description: "Get a comanda by ID with relations",
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

        // Get comanda with mesa and garcom
        const comandas = await app.db
          .select({
            id: schema.comandas.id,
            mesaId: schema.comandas.mesaId,
            mesaNumero: schema.mesas.numero,
            garcomId: schema.comandas.garcomId,
            garcomName: user.name,
            status: schema.comandas.status,
            total: schema.comandas.total,
            createdAt: schema.comandas.createdAt,
            closedAt: schema.comandas.closedAt,
          })
          .from(schema.comandas)
          .leftJoin(schema.mesas, eq(schema.comandas.mesaId, schema.mesas.id))
          .leftJoin(user, eq(schema.comandas.garcomId, user.id))
          .where(eq(schema.comandas.id, request.params.id));

        if (!comandas.length) {
          return reply.code(404).send({ error: "Comanda not found" });
        }

        const c = comandas[0];

        // Get pedidos with prato details
        const pedidos_data = await app.db
          .select({
            id: schema.pedidos.id,
            pratoId: schema.pedidos.pratoId,
            pratoNome: schema.pratos.nome,
            preco: schema.pratos.preco,
            quantidade: schema.pedidos.quantidade,
            observacao: schema.pedidos.observacao,
            status: schema.pedidos.status,
            createdAt: schema.pedidos.createdAt,
          })
          .from(schema.pedidos)
          .leftJoin(schema.pratos, eq(schema.pedidos.pratoId, schema.pratos.id))
          .where(eq(schema.pedidos.comandaId, request.params.id));

        return reply.code(200).send({
          comanda: {
            id: c.id,
            mesa_id: c.mesaId,
            mesa: {
              id: c.mesaId,
              numero: c.mesaNumero,
            },
            garcom_id: c.garcomId,
            garcom: c.garcomId ? { id: c.garcomId, name: c.garcomName } : null,
            status: c.status,
            total: c.total,
            created_at: c.createdAt.toISOString(),
            closed_at: c.closedAt?.toISOString() || null,
            pedidos: pedidos_data.map((p) => ({
              id: p.id,
              prato_id: p.pratoId,
              prato: {
                id: p.pratoId,
                nome: p.pratoNome,
                preco: parseFloat(p.preco),
              },
              quantidade: p.quantidade,
              observacao: p.observacao,
              status: p.status,
              created_at: p.createdAt.toISOString(),
            })),
          },
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
          comanda: {
            id: updated.id,
            status: updated.status,
            closed_at: updated.closedAt?.toISOString(),
          },
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
