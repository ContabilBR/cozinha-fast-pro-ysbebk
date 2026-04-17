import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth } from "../utils/auth.js";

interface CreatePedidoBody {
  comandaId: string;
  pratoId: string;
  quantidade?: number;
  precoUnitario: string;
  observacao?: string;
}

interface UpdatePedidoStatusBody {
  status: string;
}

export function registerOrderItemRoutes(app: App) {
  // GET /api/pedidos - List all pedidos
  app.fastify.get(
    "/api/pedidos",
    {
      schema: {
        description: "List all pedidos",
        tags: ["pedidos"],
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
                    comandaId: { type: "string", format: "uuid" },
                    pratoId: { type: "string", format: "uuid" },
                    pratoNome: { type: "string" },
                    quantidade: { type: "number" },
                    precoUnitario: { type: "string" },
                    observacao: { type: "string" },
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
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({}, "Listing pedidos");

        const pedidos = await app.db
          .select({
            id: schema.pedidos.id,
            comandaId: schema.pedidos.comandaId,
            pratoId: schema.pedidos.pratoId,
            pratoNome: schema.pratos.nome,
            quantidade: schema.pedidos.quantidade,
            precoUnitario: schema.pedidos.precoUnitario,
            observacao: schema.pedidos.observacao,
            status: schema.pedidos.status,
            createdAt: schema.pedidos.createdAt,
          })
          .from(schema.pedidos)
          .leftJoin(schema.pratos, eq(schema.pedidos.pratoId, schema.pratos.id));

        return reply.code(200).send({
          data: pedidos.map((p) => ({
            id: p.id,
            comandaId: p.comandaId,
            pratoId: p.pratoId,
            pratoNome: p.pratoNome || "Desconhecido",
            quantidade: p.quantidade,
            precoUnitario: p.precoUnitario,
            observacao: p.observacao,
            status: p.status,
            createdAt: p.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list pedidos");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/pedidos - Create a new pedido
  app.fastify.post<{ Body: CreatePedidoBody }>(
    "/api/pedidos",
    {
      schema: {
        description: "Create a new pedido",
        tags: ["pedidos"],
        body: {
          type: "object",
          required: ["comandaId", "pratoId", "precoUnitario"],
          properties: {
            comandaId: { type: "string", format: "uuid" },
            pratoId: { type: "string", format: "uuid" },
            quantidade: { type: "number" },
            precoUnitario: { type: "string" },
            observacao: { type: ["string", "null"] },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              comandaId: { type: "string" },
              pratoId: { type: "string" },
              quantidade: { type: "number" },
              precoUnitario: { type: "string" },
              observacao: { type: ["string", "null"] },
              status: { type: "string" },
              createdAt: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreatePedidoBody }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        if (!request.body.comandaId || !request.body.pratoId || !request.body.precoUnitario) {
          return reply.code(400).send({ error: "comandaId, pratoId, and precoUnitario are required" });
        }

        app.logger.info({ comandaId: request.body.comandaId }, "Creating pedido");

        const quantidade = request.body.quantidade || 1;
        const itemTotal = parseFloat(request.body.precoUnitario) * quantidade;

        const [pedido] = await app.db
          .insert(schema.pedidos)
          .values({
            comandaId: request.body.comandaId,
            pratoId: request.body.pratoId,
            quantidade: quantidade,
            precoUnitario: request.body.precoUnitario,
            observacao: request.body.observacao,
            status: "pendente",
          })
          .returning();

        // Update comanda total
        const comanda = await app.db
          .select()
          .from(schema.comandas)
          .where(eq(schema.comandas.id, request.body.comandaId))
          .limit(1);

        if (comanda.length > 0) {
          const newTotal = (parseFloat(comanda[0].total) + itemTotal).toFixed(2);
          await app.db
            .update(schema.comandas)
            .set({ total: newTotal })
            .where(eq(schema.comandas.id, request.body.comandaId));
        }

        app.logger.info({ pedidoId: pedido.id }, "Pedido created successfully");

        return reply.code(201).send({
          id: pedido.id,
          comandaId: pedido.comandaId,
          pratoId: pedido.pratoId,
          quantidade: pedido.quantidade,
          precoUnitario: pedido.precoUnitario,
          observacao: pedido.observacao,
          status: pedido.status,
          createdAt: pedido.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create pedido");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/pedidos/:id - Get a pedido
  app.fastify.get<{ Params: { id: string } }>(
    "/api/pedidos/:id",
    {
      schema: {
        description: "Get a pedido by ID",
        tags: ["pedidos"],
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
        app.logger.info({ pedidoId: request.params.id }, "Getting pedido");

        const pedidos = await app.db
          .select({
            id: schema.pedidos.id,
            comandaId: schema.pedidos.comandaId,
            pratoId: schema.pedidos.pratoId,
            pratoNome: schema.pratos.nome,
            quantidade: schema.pedidos.quantidade,
            precoUnitario: schema.pedidos.precoUnitario,
            observacao: schema.pedidos.observacao,
            status: schema.pedidos.status,
            createdAt: schema.pedidos.createdAt,
          })
          .from(schema.pedidos)
          .leftJoin(schema.pratos, eq(schema.pedidos.pratoId, schema.pratos.id))
          .where(eq(schema.pedidos.id, request.params.id));

        if (!pedidos.length) {
          return reply.code(404).send({ error: "Pedido not found" });
        }

        const p = pedidos[0];
        return reply.code(200).send({
          id: p.id,
          comandaId: p.comandaId,
          pratoId: p.pratoId,
          pratoNome: p.pratoNome || "Desconhecido",
          quantidade: p.quantidade,
          precoUnitario: p.precoUnitario,
          observacao: p.observacao,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get pedido");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/pedidos/:id/status - Update pedido status
  app.fastify.put<{ Params: { id: string }; Body: UpdatePedidoStatusBody }>(
    "/api/pedidos/:id/status",
    {
      schema: {
        description: "Update pedido status",
        tags: ["pedidos"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["pendente", "em_preparo", "pronto", "entregue", "cancelado"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              comandaId: { type: "string" },
              pratoId: { type: "string" },
              quantidade: { type: "number" },
              precoUnitario: { type: "string" },
              observacao: { type: ["string", "null"] },
              status: { type: "string" },
              createdAt: { type: "string" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdatePedidoStatusBody }>,
      reply: FastifyReply
    ) => {
      try {
        app.logger.info({ pedidoId: request.params.id, status: request.body.status }, "Updating pedido status");

        const existing = await app.db
          .select()
          .from(schema.pedidos)
          .where(eq(schema.pedidos.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Pedido not found" });
        }

        const [updated] = await app.db
          .update(schema.pedidos)
          .set({ status: request.body.status as any })
          .where(eq(schema.pedidos.id, request.params.id))
          .returning();

        app.logger.info({ pedidoId: updated.id }, "Pedido status updated successfully");

        return reply.code(200).send({
          id: updated.id,
          comandaId: updated.comandaId,
          pratoId: updated.pratoId,
          quantidade: updated.quantidade,
          precoUnitario: updated.precoUnitario,
          observacao: updated.observacao,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update pedido status");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/pedidos/:id - Delete a pedido
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/pedidos/:id",
    {
      schema: {
        description: "Delete a pedido",
        tags: ["pedidos"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          204: { description: "Pedido deleted" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ pedidoId: request.params.id }, "Deleting pedido");

        const existing = await app.db
          .select()
          .from(schema.pedidos)
          .where(eq(schema.pedidos.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Pedido not found" });
        }

        await app.db.delete(schema.pedidos).where(eq(schema.pedidos.id, request.params.id));

        app.logger.info({ pedidoId: request.params.id }, "Pedido deleted successfully");

        return reply.code(204).send();
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete pedido");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
