import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, sum, count, gte, and } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

export function registerRelatoriosRoutes(app: App) {
  // GET /api/relatorios/resumo - Summary/Dashboard
  app.fastify.get(
    "/api/relatorios/resumo",
    {
      schema: {
        description: "Get summary/dashboard data",
        tags: ["relatorios"],
        response: {
          200: {
            type: "object",
            properties: {
              total_mesas: { type: "number" },
              mesas_ocupadas: { type: "number" },
              comandas_abertas: { type: "number" },
              pedidos_pendentes: { type: "number" },
              receita_hoje: { type: "number" },
              receita_semana: { type: "number" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Getting resumo");

        // Total mesas
        const totalMesasResult = await app.db
          .select({ count: count() })
          .from(schema.mesas);
        const totalMesas = totalMesasResult[0]?.count || 0;

        // Mesas ocupadas
        const mesasOcupadasResult = await app.db
          .select({ count: count() })
          .from(schema.mesas)
          .where(eq(schema.mesas.status, "ocupada"));
        const mesasOcupadas = mesasOcupadasResult[0]?.count || 0;

        // Comandas abertas
        const comandasAbertasResult = await app.db
          .select({ count: count() })
          .from(schema.comandas)
          .where(eq(schema.comandas.status, "aberta"));
        const comandasAbertas = comandasAbertasResult[0]?.count || 0;

        // Pedidos pendentes
        const pedidosPendentesResult = await app.db
          .select({ count: count() })
          .from(schema.pedidos)
          .where(eq(schema.pedidos.status, "pendente"));
        const pedidosPendentes = pedidosPendentesResult[0]?.count || 0;

        // Receita hoje
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const receitaHojeResult = await app.db
          .select({ total: sum(schema.comandas.total) })
          .from(schema.comandas)
          .where(
            and(
              eq(schema.comandas.status, "fechada"),
              gte(schema.comandas.closedAt, today)
            )
          );
        const receitaHoje = parseFloat(receitaHojeResult[0]?.total || "0");

        // Receita semana (last 7 days)
        const weekAgo = new Date();
        weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
        weekAgo.setUTCHours(0, 0, 0, 0);
        const receitaSemanaResult = await app.db
          .select({ total: sum(schema.comandas.total) })
          .from(schema.comandas)
          .where(
            and(
              eq(schema.comandas.status, "fechada"),
              gte(schema.comandas.closedAt, weekAgo)
            )
          );
        const receitaSemana = parseFloat(receitaSemanaResult[0]?.total || "0");

        app.logger.info(
          { totalMesas, mesasOcupadas, comandasAbertas, pedidosPendentes, receitaHoje, receitaSemana },
          "Resumo retrieved successfully"
        );

        return reply.code(200).send({
          total_mesas: totalMesas,
          mesas_ocupadas: mesasOcupadas,
          comandas_abertas: comandasAbertas,
          pedidos_pendentes: pedidosPendentes,
          receita_hoje: receitaHoje,
          receita_semana: receitaSemana,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get resumo");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
