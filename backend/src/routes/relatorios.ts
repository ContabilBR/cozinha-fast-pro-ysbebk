import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, sum, count, gte, lt, ne, and, or, sql } from "drizzle-orm";
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

        // Mesas ocupadas (status != 'livre')
        const mesasOcupadasResult = await app.db
          .select({ count: count() })
          .from(schema.mesas)
          .where(ne(schema.mesas.status, "disponivel"));
        const mesasOcupadas = mesasOcupadasResult[0]?.count || 0;

        // Comandas abertas
        const comandasAbertasResult = await app.db
          .select({ count: count() })
          .from(schema.comandas)
          .where(eq(schema.comandas.status, "aberta"));
        const comandasAbertas = comandasAbertasResult[0]?.count || 0;

        // Pedidos pendentes (only in open comandas)
        const pedidosPendentesResult = await app.db
          .select({ count: count() })
          .from(schema.pedidos)
          .innerJoin(schema.comandas, eq(schema.pedidos.comandaId, schema.comandas.id))
          .where(
            and(
              eq(schema.pedidos.status, "pendente"),
              eq(schema.comandas.status, "aberta")
            )
          );
        const pedidosPendentes = pedidosPendentesResult[0]?.count || 0;

        // Receita hoje - sum from both comandas and comandas_historico
        // closed_at >= today's start AND closed_at < tomorrow's start (UTC)
        const todayStart = sql`DATE_TRUNC('day', NOW())`;
        const tomorrowStart = sql`DATE_TRUNC('day', NOW()) + INTERVAL '1 day'`;

        const receitaHojeComandasResult = await app.db
          .select({ total: sum(schema.comandas.total) })
          .from(schema.comandas)
          .where(
            and(
              eq(schema.comandas.status, "fechada"),
              gte(schema.comandas.closedAt, todayStart),
              lt(schema.comandas.closedAt, tomorrowStart)
            )
          );

        const receitaHojeHistoricoResult = await app.db
          .select({ total: sum(schema.comandasHistorico.total) })
          .from(schema.comandasHistorico)
          .where(
            and(
              eq(schema.comandasHistorico.status, "fechada"),
              gte(schema.comandasHistorico.closedAt, todayStart),
              lt(schema.comandasHistorico.closedAt, tomorrowStart)
            )
          );

        const receitaHojeCom = parseFloat(receitaHojeComandasResult[0]?.total || "0");
        const receitaHojeHist = parseFloat(receitaHojeHistoricoResult[0]?.total || "0");
        const receitaHoje = receitaHojeCom + receitaHojeHist;

        // Receita semana - sum from both comandas and comandas_historico
        // closed_at >= NOW() - 7 days
        const sevenDaysAgo = sql`NOW() - INTERVAL '7 days'`;

        const receitaSemanaComandasResult = await app.db
          .select({ total: sum(schema.comandas.total) })
          .from(schema.comandas)
          .where(
            and(
              eq(schema.comandas.status, "fechada"),
              gte(schema.comandas.closedAt, sevenDaysAgo)
            )
          );

        const receitaSemanaHistoricoResult = await app.db
          .select({ total: sum(schema.comandasHistorico.total) })
          .from(schema.comandasHistorico)
          .where(
            and(
              eq(schema.comandasHistorico.status, "fechada"),
              gte(schema.comandasHistorico.closedAt, sevenDaysAgo)
            )
          );

        const receitaSemanaCom = parseFloat(receitaSemanaComandasResult[0]?.total || "0");
        const receitaSemanaHist = parseFloat(receitaSemanaHistoricoResult[0]?.total || "0");
        const receitaSemana = receitaSemanaCom + receitaSemanaHist;

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
