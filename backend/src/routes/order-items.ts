import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, sql, desc } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth } from "../utils/auth.js";

interface CreatePedidoBody {
  comanda_id?: string;
  comandaId?: string;
  prato_id?: string;
  pratoId?: string;
  quantidade?: number;
  observacao?: string;
}

interface UpdatePedidoStatusBody {
  status: string;
}

// Helper function to normalize decimal values (comma to dot)
function normalizeDecimal(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value.replace(',', '.'));
  return value;
}

export function registerOrderItemRoutes(app: App) {
  // GET /api/pedidos - List all pedidos for authenticated user
  app.fastify.get(
    "/api/pedidos",
    {
      schema: {
        description: "List all pedidos for authenticated user (requires authentication)",
        tags: ["pedidos"],
        response: {
          200: {
            type: "object",
            properties: {
              pedidos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    comanda_id: { type: "string", format: "uuid" },
                    prato_id: { type: ["string", "null"], format: "uuid" },
                    prato_nome: { type: ["string", "null"] },
                    quantidade: { type: "number" },
                    preco_unitario: { type: "string" },
                    observacao: { type: ["string", "null"] },
                    status: { type: "string" },
                    created_at: { type: "string", format: "date-time" },
                    mesa_numero: { type: "number" },
                    comanda_status: { type: "string" },
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
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        const authUserId = authUser.id;
        app.logger.info({ authUserId }, "Listing pedidos for user");

        const pedidos = await app.db
          .select({
            id: schema.pedidos.id,
            comandaId: schema.pedidos.comandaId,
            pratoId: schema.pedidos.pratoId,
            quantidade: schema.pedidos.quantidade,
            precoUnitario: schema.pedidos.precoUnitario,
            observacao: schema.pedidos.observacao,
            status: schema.pedidos.status,
            createdAt: schema.pedidos.createdAt,
            pratoNome: schema.pratos.nome,
            pratoDescricao: schema.pratos.descricao,
            pratoImagem: schema.pratos.imagemUrl,
            mesaNumero: schema.mesas.numero,
            comandaStatus: schema.comandas.status,
            garcomId: schema.comandas.garcomId,
          })
          .from(schema.pedidos)
          .innerJoin(schema.comandas, eq(schema.pedidos.comandaId, schema.comandas.id))
          .innerJoin(schema.mesas, eq(schema.comandas.mesaId, schema.mesas.id))
          .leftJoin(schema.pratos, eq(schema.pedidos.pratoId, schema.pratos.id))
          .where(eq(schema.comandas.garcomId, authUserId))
          .orderBy(desc(schema.pedidos.createdAt));

        app.logger.info({ count: pedidos.length }, "Pedidos retrieved");

        return reply.code(200).send({
          pedidos: pedidos.map((p) => ({
            id: p.id,
            comanda_id: p.comandaId,
            prato_id: p.pratoId,
            quantidade: p.quantidade,
            preco_unitario: p.precoUnitario,
            observacao: p.observacao,
            status: p.status,
            created_at: p.createdAt ? new Date(p.createdAt).toISOString() : null,
            prato_nome: p.pratoNome,
            prato_descricao: p.pratoDescricao,
            prato_imagem: p.pratoImagem,
            mesa_numero: p.mesaNumero,
            comanda_status: p.comandaStatus,
            garcom_id: p.garcomId,
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
          required: ["comanda_id", "prato_id"],
          properties: {
            comanda_id: { type: "string", format: "uuid" },
            comandaId: { type: "string", format: "uuid" },
            prato_id: { type: "string", format: "uuid" },
            pratoId: { type: "string", format: "uuid" },
            quantidade: { type: "number" },
            observacao: { type: ["string", "null"] },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              pedido: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  comanda_id: { type: "string" },
                  prato_id: { type: "string" },
                  quantidade: { type: "number" },
                  preco_unitario: { type: "string" },
                  observacao: { type: ["string", "null"] },
                  status: { type: "string" },
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
    async (request: FastifyRequest<{ Body: CreatePedidoBody }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        const comandaId = request.body.comanda_id || request.body.comandaId;
        const pratoId = request.body.prato_id || request.body.pratoId;

        if (!comandaId || !pratoId) {
          return reply.code(400).send({ error: "comanda_id and prato_id are required" });
        }

        app.logger.info({ comandaId, pratoId }, "Creating pedido");

        // Look up prato to get price
        const prato = await app.db
          .select()
          .from(schema.pratos)
          .where(eq(schema.pratos.id, pratoId))
          .limit(1);

        if (!prato.length) {
          return reply.code(404).send({ error: "Prato not found" });
        }

        // Check if comanda exists
        const comanda = await app.db
          .select()
          .from(schema.comandas)
          .where(eq(schema.comandas.id, comandaId))
          .limit(1);

        if (!comanda.length) {
          return reply.code(404).send({ error: "Comanda not found" });
        }

        const quantidade = request.body.quantidade || 1;
        const precoUnitario = prato[0].preco;
        const itemTotal = parseFloat(precoUnitario) * quantidade;

        const [pedido] = await app.db
          .insert(schema.pedidos)
          .values({
            comandaId,
            pratoId,
            quantidade,
            precoUnitario,
            observacao: request.body.observacao,
            status: "pendente",
          })
          .returning();

        // Update comanda total
        const newTotal = (parseFloat(comanda[0].total) + itemTotal).toFixed(2);
        await app.db
          .update(schema.comandas)
          .set({ total: newTotal })
          .where(eq(schema.comandas.id, comandaId));

        app.logger.info({ pedidoId: pedido.id }, "Pedido created successfully");

        return reply.code(201).send({
          pedido: {
            id: pedido.id,
            comanda_id: pedido.comandaId,
            prato_id: pedido.pratoId,
            quantidade: pedido.quantidade,
            preco_unitario: pedido.precoUnitario,
            observacao: pedido.observacao,
            status: pedido.status,
            created_at: pedido.createdAt.toISOString(),
          },
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
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

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
