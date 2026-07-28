import { eq, and } from "drizzle-orm";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth, requireTenant } from "../utils/auth.js";
import * as schema from "../db/schema/schema.js";

export function registerPagamentoRoutes(app: App) {
  const db = app.db as any;

  // POST /api/comandas/:id/pagamentos — registrar pagamento
  app.fastify.post<{ Params: { id: string }; Body: { forma_pagamento: string; valor: number; troco?: number; referencia?: string } }>(
    "/api/comandas/:id/pagamentos",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", format: "uuid" } }, required: ["id"] },
        body: {
          type: "object",
          properties: {
            forma_pagamento: { type: "string", enum: ["pix", "dinheiro", "cartao_credito", "cartao_debito"] },
            valor: { type: "number", minimum: 0.01 },
            troco: { type: "number", minimum: 0 },
            referencia: { type: "string" },
          },
          required: ["forma_pagamento", "valor"],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { forma_pagamento: string; valor: number; troco?: number; referencia?: string } }>, reply: FastifyReply) => {
      try {
        const authUser = await customRequireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        // Verificar se comanda existe e pertence ao tenant
        const comanda = await db.select({ id: schema.comandas.id, status: schema.comandas.status, total: schema.comandas.total }).from(schema.comandas).where(and(eq(schema.comandas.id, request.params.id), eq(schema.comandas.restauranteId, restauranteId)));
        if (!comanda.length) return reply.code(404).send({ error: "Comanda não encontrada" });
        if (comanda[0].status !== "aberta") return reply.code(400).send({ error: "Comanda não está aberta" });

        const { forma_pagamento, valor, troco, referencia } = request.body;

        // Calcular total já pago
        const pagamentosExistentes = await db.select({ valor: schema.pagamentos.valor }).from(schema.pagamentos).where(and(eq(schema.pagamentos.comandaId, request.params.id), eq(schema.pagamentos.status, "confirmado")));
        const totalPago = pagamentosExistentes.reduce((sum: number, p: any) => sum + parseFloat(p.valor), 0);
        const totalComanda = parseFloat(comanda[0].total || "0");
        const restante = totalComanda - totalPago;

        if (valor > restante + 0.01) {
          return reply.code(400).send({ error: `Valor excede o restante da comanda. Restante: R$ ${restante.toFixed(2)}` });
        }

        // Dinheiro e cartão são confirmados imediatamente. Pix fica pendente.
        const statusPagamento = forma_pagamento === "pix" ? "pendente" : "confirmado";
        const confirmadoEm = statusPagamento === "confirmado" ? new Date() : null;

        const [pagamento] = await db.insert(schema.pagamentos).values({
          comandaId: request.params.id,
          formaPagamento: forma_pagamento,
          status: statusPagamento,
          valor: valor.toString(),
          troco: (troco || 0).toString(),
          referencia: referencia || null,
          confirmadoEm,
          restauranteId,
        }).returning();

        return reply.code(201).send({
          pagamento,
          resumo: { total_comanda: totalComanda, total_pago: totalPago + (statusPagamento === "confirmado" ? valor : 0), restante: restante - (statusPagamento === "confirmado" ? valor : 0) },
        });
      } catch (err) {
        app.logger.error({ error: (err as any).message }, "Erro ao registrar pagamento");
        return reply.code(500).send({ error: "Erro interno do servidor" });
      }
    }
  );

  // GET /api/comandas/:id/pagamentos — listar pagamentos de uma comanda
  app.fastify.get<{ Params: { id: string } }>(
    "/api/comandas/:id/pagamentos",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const authUser = await customRequireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const comanda = await db.select({ id: schema.comandas.id }).from(schema.comandas).where(and(eq(schema.comandas.id, request.params.id), eq(schema.comandas.restauranteId, restauranteId)));
        if (!comanda.length) return reply.code(404).send({ error: "Comanda não encontrada" });

        const pagamentos = await db.select().from(schema.pagamentos).where(eq(schema.pagamentos.comandaId, request.params.id));

        const totalPago = pagamentos.filter((p: any) => p.status === "confirmado").reduce((sum: number, p: any) => sum + parseFloat(p.valor), 0);

        return reply.code(200).send({ pagamentos, total_pago: totalPago });
      } catch (err) {
        app.logger.error({ error: (err as any).message }, "Erro ao listar pagamentos");
        return reply.code(500).send({ error: "Erro interno do servidor" });
      }
    }
  );

  // DELETE /api/pagamentos/:id — cancelar pagamento pendente
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/pagamentos/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const authUser = await customRequireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const pagamento = await db.select().from(schema.pagamentos).where(and(eq(schema.pagamentos.id, request.params.id), eq(schema.pagamentos.restauranteId, restauranteId)));
        if (!pagamento.length) return reply.code(404).send({ error: "Pagamento não encontrado" });
        if (pagamento[0].status === "confirmado") return reply.code(400).send({ error: "Pagamento já confirmado não pode ser cancelado" });

        await db.update(schema.pagamentos).set({ status: "cancelado" }).where(eq(schema.pagamentos.id, request.params.id));

        return reply.code(200).send({ success: true, message: "Pagamento cancelado" });
      } catch (err) {
        app.logger.error({ error: (err as any).message }, "Erro ao cancelar pagamento");
        return reply.code(500).send({ error: "Erro interno do servidor" });
      }
    }
  );
}
