import { eq, and } from "drizzle-orm";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth, requireTenant } from "../utils/auth.js";
import * as schema from "../db/schema/schema.js";

// === Asaas Service ===
const ASAAS_BASE_URL = process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/api/v3" : "https://sandbox.asaas.com/api/v3";

function getAsaasApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY não configurada");
  return key;
}

async function asaasRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(ASAAS_BASE_URL + path, { method, headers: { "Content-Type": "application/json", "access_token": getAsaasApiKey() }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { const errorText = await res.text(); throw new Error("Asaas API error " + res.status + ": " + errorText); }
  return res.json();
}

async function getOrCreateCustomer(restauranteId: string, restauranteNome: string): Promise<string> {
  const search = await asaasRequest("GET", "/customers?externalReference=" + restauranteId);
  if (search.data && search.data.length > 0) return search.data[0].id;
  const customer = await asaasRequest("POST", "/customers", { name: "Consumidor - " + restauranteNome, cpfCnpj: "00000000000", externalReference: restauranteId });
  return customer.id;
}

async function criarCobrancaPix(params: { customerId: string; valor: number; descricao: string; externalReference: string }): Promise<{ paymentId: string; status: string }> {
  const hoje = new Date().toISOString().split("T")[0];
  const payment = await asaasRequest("POST", "/payments", { customer: params.customerId, billingType: "PIX", value: params.valor, dueDate: hoje, description: params.descricao, externalReference: params.externalReference });
  return { paymentId: payment.id, status: payment.status };
}

async function buscarQrCodePix(paymentId: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
  const qr = await asaasRequest("GET", "/payments/" + paymentId + "/pixQrCode");
  return { encodedImage: qr.encodedImage, payload: qr.payload, expirationDate: qr.expirationDate };
}
// === Fim Asaas Service ===

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

        // Only validate overpayment if comanda has a total
        if (totalComanda > 0 && valor > restante + 0.01) {
          return reply.code(400).send({ error: `Valor excede o restante da comanda. Restante: R$ ${restante.toFixed(2)}` });
        }

        // Dinheiro e cartão são confirmados imediatamente. Pix vai para Asaas.
        let statusPagamento: string = "confirmado";
        let confirmadoEm: Date | null = new Date();
        let pixTxId: string | null = null;
        let pixQrCode: string | null = null;
        let pixQrCodeBase64: string | null = null;

        if (forma_pagamento === "pix") {
          statusPagamento = "pendente";
          confirmadoEm = null;
          try {
            const rest = await db.select({ nome: schema.restaurante.nome }).from(schema.restaurante).where(eq(schema.restaurante.id, restauranteId));
            const nomeRestaurante = rest[0]?.nome || "Restaurante";
            const customerId = await getOrCreateCustomer(restauranteId, nomeRestaurante);
            const cobranca = await criarCobrancaPix({ customerId, valor, descricao: "Comanda " + request.params.id.slice(0, 8), externalReference: request.params.id });
            pixTxId = cobranca.paymentId;
            const qr = await buscarQrCodePix(cobranca.paymentId);
            pixQrCode = qr.payload;
            pixQrCodeBase64 = qr.encodedImage;
          } catch (err) {
            app.logger.error({ error: (err as any).message }, "Erro ao criar cobrança Pix no Asaas");
            return reply.code(502).send({ error: "Erro ao gerar QR Code Pix. Verifique se a chave ASAAS_API_KEY está configurada." });
          }
        }

        const [pagamento] = await db.insert(schema.pagamentos).values({
          comandaId: request.params.id,
          formaPagamento: forma_pagamento,
          status: statusPagamento,
          valor: valor.toString(),
          troco: (troco || 0).toString(),
          pixTxId,
          pixQrCode,
          pixQrCodeBase64,
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

  // POST /api/webhooks/asaas — recebe notificações do Asaas
  app.fastify.post("/api/webhooks/asaas", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const event = body?.event;
      const payment = body?.payment;
      if (!event || !payment) return reply.code(400).send({ error: "Payload inválido" });
      app.logger.info({ event, paymentId: payment.id }, "Webhook Asaas recebido");
      if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
        const paymentId = payment.id;
        const pagamentos = await db.select().from(schema.pagamentos).where(eq(schema.pagamentos.pixTxId, paymentId));
        if (pagamentos.length > 0) {
          await db.update(schema.pagamentos).set({ status: "confirmado", confirmadoEm: new Date() }).where(eq(schema.pagamentos.pixTxId, paymentId));
          app.logger.info({ paymentId, comandaId: pagamentos[0].comandaId }, "Pagamento Pix confirmado via webhook");
        } else {
          app.logger.warn({ paymentId }, "Webhook recebido mas pagamento não encontrado");
        }
      }
      return reply.code(200).send({ received: true });
    } catch (err) {
      app.logger.error({ error: (err as any).message }, "Erro ao processar webhook Asaas");
      return reply.code(200).send({ received: true });
    }
  });
}
