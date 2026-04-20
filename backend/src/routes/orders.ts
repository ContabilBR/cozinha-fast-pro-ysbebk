import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, sql, inArray, or, and } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth } from "../utils/auth.js";
import { resolveGarcomId } from "../utils/garcom.js";

interface CreateComandaBody {
  mesaId?: string;
  mesa_id?: string;
  garcomId?: string;
  garcom_id?: string;
}

interface CreatePedidosBody {
  items: Array<{
    prato_id: string;
    quantidade: number;
    observacao?: string;
    preco_unitario: number;
  }>;
}

interface FecharComandaBody {
  total?: string;
}

export function registerOrderRoutes(app: App) {
  // GET /api/comandas - List all comandas for authenticated user
  app.fastify.get<{ Querystring: { status?: string } }>(
    "/api/comandas",
    {
      schema: {
        description: "List all comandas for authenticated user (requires authentication)",
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
                    mesa_id: { type: "string", format: "uuid" },
                    mesa_numero: { type: "number" },
                    mesa_status: { type: "string" },
                    garcom_id: { type: ["string", "null"] },
                    status: { type: "string" },
                    total: { type: "string" },
                    created_at: { type: "string", format: "date-time" },
                    closed_at: { type: ["string", "null"], format: "date-time" },
                  },
                },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        const authUserId = authUser.id;

        app.logger.info(
          { authUserId, status: request.query.status },
          "Listing comandas for user"
        );

        // Build where conditions
        const whereConditions = [eq(schema.comandas.garcomId, authUserId)];
        if (request.query.status) {
          whereConditions.push(eq(schema.comandas.status, request.query.status as any));
        }

        // Combine conditions with AND
        const whereClause = whereConditions.length > 1
          ? and(...whereConditions)
          : whereConditions[0];

        const comandas = await app.db
          .select({
            id: schema.comandas.id,
            mesaId: schema.comandas.mesaId,
            mesaNumero: schema.mesas.numero,
            mesaStatus: schema.mesas.status,
            garcomId: schema.comandas.garcomId,
            status: schema.comandas.status,
            total: schema.comandas.total,
            createdAt: schema.comandas.createdAt,
            closedAt: schema.comandas.closedAt,
          })
          .from(schema.comandas)
          .leftJoin(schema.mesas, eq(schema.comandas.mesaId, schema.mesas.id))
          .where(whereClause)
          .orderBy(schema.comandas.createdAt);

        app.logger.info({ count: comandas.length }, "Comandas retrieved");

        return reply.code(200).send({
          comandas: comandas.map((c) => ({
            id: c.id,
            mesa_id: c.mesaId,
            mesa_numero: c.mesaNumero,
            mesa_status: c.mesaStatus,
            garcom_id: c.garcomId,
            status: c.status,
            total: c.total,
            created_at: c.createdAt.toISOString(),
            closed_at: c.closedAt ? c.closedAt.toISOString() : null,
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list comandas");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/comandas - Open a new comanda for a table
  app.fastify.post<{ Body: CreateComandaBody }>(
    "/api/comandas",
    {
      schema: {
        description: "Open a new comanda for a table (requires authentication)",
        tags: ["comandas"],
        body: {
          type: "object",
          properties: {
            mesa_id: { type: "string", format: "uuid" },
            mesaId: { type: "string", format: "uuid" },
            garcom_id: { type: "string" },
            garcomId: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              comanda: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  mesa_id: { type: "string", format: "uuid" },
                  garcom_id: { type: "string" },
                  status: { type: "string" },
                  total: { type: "string" },
                  created_at: { type: "string", format: "date-time" },
                },
              },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateComandaBody }>, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        const mesaId = request.body.mesa_id || request.body.mesaId;

        if (!mesaId) {
          return reply.code(400).send({ error: "mesa_id is required" });
        }

        // Check if mesa exists
        const mesaRecords = await app.db
          .select()
          .from(schema.mesas)
          .where(eq(schema.mesas.id, mesaId))
          .limit(1);

        if (!mesaRecords.length) {
          return reply.code(404).send({ error: "Mesa not found" });
        }

        const mesa = mesaRecords[0];

        // Store garcom_id as the authenticated user's id (text, stable across deploys)
        const garcomId = authUser.id;

        app.logger.info(
          {
            mesaId,
            garcomId,
            authUserEmail: authUser.email,
          },
          "Creating comanda with auth user id as garcom_id"
        );

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

        app.logger.info({ comandaId: comanda.id, mesaId }, "Comanda created successfully");

        return reply.code(201).send({
          comanda: {
            id: comanda.id,
            mesa_id: comanda.mesaId,
            garcom_id: comanda.garcomId,
            status: comanda.status,
            total: comanda.total,
            created_at: comanda.createdAt.toISOString(),
            mesa: {
              numero: mesa.numero,
            },
          },
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create comanda");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/comandas/:id - Get a comanda by ID with pedidos and mesa info
  app.fastify.get<{ Params: { id: string } }>(
    "/api/comandas/:id",
    {
      schema: {
        description: "Get a comanda by ID with pedidos and mesa info (requires authentication)",
        tags: ["comandas"],
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
              mesa_id: { type: "string", format: "uuid" },
              garcom_id: { type: "string" },
              status: { type: "string" },
              total: { type: "string" },
              created_at: { type: "string", format: "date-time" },
              mesa: {
                type: "object",
                properties: {
                  numero: { type: "number" },
                },
              },
              pedidos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    prato_id: { type: "string", format: "uuid" },
                    quantidade: { type: "number" },
                    preco_unitario: { type: "string" },
                    observacao: { type: ["string", "null"] },
                    status: { type: "string" },
                    created_at: { type: "string", format: "date-time" },
                    prato: {
                      type: "object",
                      properties: {
                        nome: { type: "string" },
                        imagem_url: { type: ["string", "null"] },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ comandaId: request.params.id }, "Getting comanda");

        // Get comanda with mesa
        const comandas = await app.db
          .select({
            id: schema.comandas.id,
            mesaId: schema.comandas.mesaId,
            mesaNumero: schema.mesas.numero,
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

        // Get pedidos with prato details
        const pedidos_data = await app.db
          .select({
            id: schema.pedidos.id,
            pratoId: schema.pedidos.pratoId,
            pratoNome: schema.pratos.nome,
            imagemUrl: schema.pratos.imagemUrl,
            quantidade: schema.pedidos.quantidade,
            precoUnitario: schema.pedidos.precoUnitario,
            observacao: schema.pedidos.observacao,
            status: schema.pedidos.status,
            createdAt: schema.pedidos.createdAt,
          })
          .from(schema.pedidos)
          .leftJoin(schema.pratos, eq(schema.pedidos.pratoId, schema.pratos.id))
          .where(eq(schema.pedidos.comandaId, request.params.id));

        app.logger.info({ comandaId: request.params.id, itemsCount: pedidos_data.length }, "Comanda retrieved successfully");

        return reply.code(200).send({
          id: c.id,
          mesa_id: c.mesaId,
          garcom_id: c.garcomId,
          status: c.status,
          total: c.total,
          created_at: c.createdAt.toISOString(),
          mesa: {
            numero: c.mesaNumero,
          },
          pedidos: pedidos_data.map((p) => ({
            id: p.id,
            prato_id: p.pratoId,
            quantidade: p.quantidade,
            preco_unitario: p.precoUnitario,
            observacao: p.observacao,
            status: p.status,
            created_at: p.createdAt.toISOString(),
            prato: {
              nome: p.pratoNome,
              imagem_url: p.imagemUrl,
            },
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get comanda");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/comandas/:id/pedidos - Add multiple pedidos to a comanda
  app.fastify.post<{ Params: { id: string }; Body: CreatePedidosBody }>(
    "/api/comandas/:id/pedidos",
    {
      schema: {
        description: "Add multiple pedidos to a comanda (requires authentication)",
        tags: ["comandas"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["prato_id", "quantidade", "preco_unitario"],
                properties: {
                  prato_id: { type: "string", format: "uuid" },
                  quantidade: { type: "number" },
                  observacao: { type: ["string", "null"] },
                  preco_unitario: { type: "number" },
                },
              },
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              pedidos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    comanda_id: { type: "string", format: "uuid" },
                    prato_id: { type: "string", format: "uuid" },
                    quantidade: { type: "number" },
                    preco_unitario: { type: "string" },
                    observacao: { type: ["string", "null"] },
                    status: { type: "string" },
                    created_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: CreatePedidosBody }>,
      reply: FastifyReply
    ) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        const comandaId = request.params.id;

        if (!request.body.items || !Array.isArray(request.body.items) || request.body.items.length === 0) {
          return reply.code(400).send({ error: "items array is required and must not be empty" });
        }

        // Verify comanda exists
        const comandas = await app.db
          .select()
          .from(schema.comandas)
          .where(eq(schema.comandas.id, comandaId))
          .limit(1);

        if (!comandas.length) {
          return reply.code(404).send({ error: "Comanda not found" });
        }

        const comanda = comandas[0];

        // Resolve garcom_id and verify ownership
        const { garcomId: resolvedGarcomId } = await resolveGarcomId(app, authUser.email, authUser.id);

        if (comanda.garcomId !== resolvedGarcomId) {
          app.logger.warn(
            { comandaId, expectedGarcomId: resolvedGarcomId, actualGarcomId: comanda.garcomId },
            "Unauthorized access to comanda"
          );
          return reply.code(403).send({ error: "Unauthorized access to this comanda" });
        }

        // Verify all pratos exist
        const uniquePratoIds = Array.from(new Set(request.body.items.map((item) => item.prato_id)));
        const pratos = await app.db
          .select({ id: schema.pratos.id })
          .from(schema.pratos)
          .where(inArray(schema.pratos.id, uniquePratoIds));

        if (pratos.length !== uniquePratoIds.length) {
          return reply.code(404).send({ error: "One or more pratos not found" });
        }

        app.logger.info({ comandaId, itemsCount: request.body.items.length }, "Adding pedidos to comanda");

        // Insert all items
        const insertedPedidos = await app.db
          .insert(schema.pedidos)
          .values(
            request.body.items.map((item) => ({
              comandaId,
              pratoId: item.prato_id,
              quantidade: item.quantidade,
              precoUnitario: item.preco_unitario.toString(),
              observacao: item.observacao || null,
              status: "pendente" as any,
            }))
          )
          .returning();

        // Recalculate total: SUM(quantidade * preco_unitario)
        const allPedidos = await app.db
          .select()
          .from(schema.pedidos)
          .where(eq(schema.pedidos.comandaId, comandaId));

        const total = allPedidos.reduce((sum, p) => {
          return sum + parseFloat(p.precoUnitario) * p.quantidade;
        }, 0);

        // Update comanda total
        await app.db
          .update(schema.comandas)
          .set({ total: total.toString() })
          .where(eq(schema.comandas.id, comandaId));

        app.logger.info(
          { comandaId, insertedCount: insertedPedidos.length, newTotal: total },
          "Pedidos added successfully"
        );

        return reply.code(201).send({
          pedidos: insertedPedidos.map((p) => ({
            id: p.id,
            comanda_id: p.comandaId,
            prato_id: p.pratoId,
            quantidade: p.quantidade,
            preco_unitario: p.precoUnitario,
            observacao: p.observacao,
            status: p.status,
            created_at: p.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to add pedidos to comanda");
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

  // DELETE /api/comandas/:id - Delete a comanda and all its pedidos
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/comandas/:id",
    {
      schema: {
        description: "Delete a comanda and all its pedidos",
        tags: ["comandas"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          204: { description: "Comanda deleted successfully" },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ comandaId: request.params.id }, "Deleting comanda");

        const existing = await app.db
          .select()
          .from(schema.comandas)
          .where(eq(schema.comandas.id, request.params.id));

        if (!existing.length) {
          app.logger.warn({ comandaId: request.params.id }, "Comanda not found");
          return reply.code(404).send({ error: "Comanda not found" });
        }

        const comanda = existing[0];

        // Delete all pedidos for this comanda
        app.logger.debug({ comandaId: request.params.id }, "Deleting pedidos for comanda");
        await app.db
          .delete(schema.pedidos)
          .where(eq(schema.pedidos.comandaId, request.params.id));

        // Delete the comanda
        await app.db
          .delete(schema.comandas)
          .where(eq(schema.comandas.id, request.params.id));

        // Update mesa status back to livre
        await app.db
          .update(schema.mesas)
          .set({ status: "livre" })
          .where(eq(schema.mesas.id, comanda.mesaId));

        app.logger.info({ comandaId: request.params.id }, "Comanda deleted successfully");

        return reply.code(204).send();
      } catch (error) {
        app.logger.error({ err: error, comandaId: request.params.id }, "Failed to delete comanda");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PATCH /api/pedidos/:id/observacao - Update pedido observacao
  interface UpdateObservacaoBody {
    observacao: string;
  }

  app.fastify.patch<{ Params: { id: string }; Body: UpdateObservacaoBody }>(
    "/api/pedidos/:id/observacao",
    {
      schema: {
        description: "Update observacao for a pedido",
        tags: ["pedidos"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["observacao"],
          properties: {
            observacao: { type: "string" },
          },
        },
        response: {
          200: {
            description: "Pedido updated successfully",
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              comanda_id: { type: "string", format: "uuid" },
              prato_id: { type: ["string", "null"], format: "uuid" },
              quantidade: { type: "number" },
              preco_unitario: { type: "string" },
              observacao: { type: ["string", "null"] },
              status: { type: "string" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateObservacaoBody }>,
      reply: FastifyReply
    ) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ pedidoId: request.params.id }, "Updating pedido observacao");

        const existing = await app.db
          .select()
          .from(schema.pedidos)
          .where(eq(schema.pedidos.id, request.params.id));

        if (!existing.length) {
          app.logger.warn({ pedidoId: request.params.id }, "Pedido not found");
          return reply.code(404).send({ error: "Pedido not found" });
        }

        const [updated] = await app.db
          .update(schema.pedidos)
          .set({
            observacao: request.body.observacao,
          })
          .where(eq(schema.pedidos.id, request.params.id))
          .returning();

        app.logger.info({ pedidoId: updated.id }, "Pedido observacao updated successfully");

        return reply.code(200).send({
          id: updated.id,
          comanda_id: updated.comandaId,
          prato_id: updated.pratoId,
          quantidade: updated.quantidade,
          preco_unitario: updated.precoUnitario,
          observacao: updated.observacao,
          status: updated.status,
          created_at: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error, pedidoId: request.params.id }, "Failed to update pedido observacao");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
