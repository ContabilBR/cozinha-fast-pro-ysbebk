import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, desc, isNotNull, sql } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

export function registerHistoricoRoutes(app: App) {
  // GET /api/historico - Get all archived comandas with their pedidos
  app.fastify.get(
    "/api/historico",
    {
      schema: {
        description: "Get all archived comandas with their pedidos (no auth required)",
        tags: ["historico"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                mesa_id: { type: ["string", "null"], format: "uuid" },
                mesa_numero: { type: ["integer", "null"] },
                garcom_id: { type: ["string", "null"] },
                status: { type: "string" },
                total: { type: "string" },
                created_at: { type: "string", format: "date-time" },
                closed_at: { type: ["string", "null"], format: "date-time" },
                archived_at: { type: "string", format: "date-time" },
                pedidos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      prato_id: { type: ["string", "null"], format: "uuid" },
                      prato_nome: { type: ["string", "null"] },
                      quantidade: { type: "integer" },
                      preco_unitario: { type: "string" },
                      observacao: { type: ["string", "null"] },
                      status: { type: "string" },
                      created_at: { type: "string", format: "date-time" },
                      archived_at: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
          500: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Fetching archived comandas and pedidos");

        // Query all comandas_historico ordered by archived_at descending
        const comandas = await app.db
          .select()
          .from(schema.comandasHistorico)
          .orderBy(desc(schema.comandasHistorico.archivedAt));

        app.logger.info({ count: comandas.length }, "Archived comandas retrieved");

        // For each comanda, fetch its pedidos from pedidos_historico
        const result = await Promise.all(
          comandas.map(async (comanda) => {
            const pedidos = await app.db
              .select()
              .from(schema.pedidosHistorico)
              .where(eq(schema.pedidosHistorico.comandaId, comanda.id))
              .orderBy(desc(schema.pedidosHistorico.archivedAt));

            return {
              id: comanda.id,
              mesa_id: comanda.mesaId,
              mesa_numero: comanda.mesaNumero,
              garcom_id: comanda.garcomId,
              status: comanda.status,
              total: comanda.total.toString(),
              created_at: comanda.createdAt.toISOString(),
              closed_at: comanda.closedAt ? comanda.closedAt.toISOString() : null,
              archived_at: comanda.archivedAt.toISOString(),
              pedidos: pedidos.map((p) => ({
                id: p.id,
                prato_id: p.pratoId,
                prato_nome: p.pratoNome,
                quantidade: p.quantidade,
                preco_unitario: p.precoUnitario.toString(),
                observacao: p.observacao,
                status: p.status,
                created_at: p.createdAt.toISOString(),
                archived_at: p.archivedAt.toISOString(),
              })),
            };
          })
        );

        return reply.code(200).send(result);
      } catch (error) {
        app.logger.error({ err: error }, "Failed to fetch historico");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
