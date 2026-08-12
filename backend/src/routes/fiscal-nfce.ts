/**
 * POST /api/fiscal/nfce — emissao de cupom fiscal eletronico (modelo 65).
 * Orquestra nfce-data (carga), nfce-builder (montagem) e focus (envio).
 */

import { eq } from "drizzle-orm";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";
import { requireAuth, requireTenant } from "../utils/auth.js";
import * as schema from "../db/schema/schema.js";
import { focusRequest } from "../services/focus.js";
import {
  buildNfcePayload,
  validarRestauranteParaNfce,
  limparDocumento,
} from "../utils/fiscal-payloads.js";
import type { DestinatarioInput } from "../utils/fiscal-payloads.js";
import {
  isoBrasilia,
  montarRestauranteInput,
  montarFormasPagamento,
  ajustarFormasPagamento,
  montarItensFiscais,
  calcularValorItens,
} from "../services/nfce-builder.js";
import {
  carregarComandaFiscal,
  carregarPagamentosFiscais,
  carregarPedidosFiscais,
  carregarPratosMap,
  buscarNfceBloqueante,
  proximoNumeroNfce,
} from "../services/nfce-data.js";

export function registerFiscalNfceRoutes(app: App) {
  const db = app.db as any;

  const errorResponse = {
    type: "object",
    additionalProperties: true,
    properties: {
      error: { type: "string" },
      detail: { type: "string" },
      campos_faltantes: { type: "array", items: { type: "string" } },
    },
  };

  app.fastify.post(
    "/api/fiscal/nfce",
    {
      schema: {
        description: "Emitir NFC-e (cupom fiscal eletronico, modelo 65) para uma comanda",
        tags: ["fiscal"],
        body: {
          type: "object",
          required: ["comanda_id"],
          properties: {
            comanda_id: { type: "string", format: "uuid" },
            cpf_destinatario: { type: "string" },
            cnpj_destinatario: { type: "string" },
            nome_destinatario: { type: "string" },
            email_destinatario: { type: "string" },
            serie: { type: "integer" },
            presenca_comprador: { type: "integer" },
          },
        },
        response: {
          200: { type: "object", additionalProperties: true },
          400: { description: "Requisicao invalida", ...errorResponse },
          404: { description: "Recurso nao encontrado", ...errorResponse },
          409: { description: "NFC-e ja emitida para esta comanda", ...errorResponse },
          502: { description: "Erro na comunicacao com Focus NFe", ...errorResponse },
          500: { description: "Erro interno", ...errorResponse },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          comanda_id: string;
          cpf_destinatario?: string;
          cnpj_destinatario?: string;
          nome_destinatario?: string;
          email_destinatario?: string;
          serie?: number;
          presenca_comprador?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const {
          comanda_id,
          cpf_destinatario,
          cnpj_destinatario,
          nome_destinatario,
          email_destinatario,
          serie,
          presenca_comprador,
        } = request.body;

        app.logger.info({ comandaId: comanda_id, restauranteId }, "POST /api/fiscal/nfce iniciado");

        // 1. Restaurante + validacao fiscal
        const restRows = await db
          .select()
          .from(schema.restaurante)
          .where(eq(schema.restaurante.id, restauranteId));
        if (!restRows.length) {
          return reply.code(404).send({ error: "Restaurante nao encontrado" });
        }
        const restaurante = restRows[0];
        const restauranteInput = montarRestauranteInput(restaurante);

        const validacao = validarRestauranteParaNfce(restauranteInput);
        if (!validacao.ok) {
          app.logger.warn(
            { restauranteId, campos: validacao.camposFaltantes },
            "Restaurante sem dados fiscais completos"
          );
          return reply.code(400).send({
            error: "Restaurante sem dados fiscais completos para emitir NFC-e",
            campos_faltantes: validacao.camposFaltantes,
          });
        }

        // 2. Comanda (viva ou arquivada)
        const encontrada = await carregarComandaFiscal(db, comanda_id, restauranteId);
        if (!encontrada) {
          return reply.code(404).send({ error: "Comanda nao encontrada neste restaurante" });
        }
        const { arquivada } = encontrada;

        // 3. Idempotencia
        const bloqueante = await buscarNfceBloqueante(db, comanda_id, restauranteId);
        if (bloqueante) {
          return reply.code(409).send({
            error: "Ja existe NFC-e " + bloqueante.status + " para esta comanda",
            referencia_focus: bloqueante.referenciaFocus,
            nota_id: bloqueante.id,
          });
        }

        // 4. Pagamentos confirmados
        const pagRows = await carregarPagamentosFiscais(db, comanda_id, restauranteId, arquivada);
        const confirmados = pagRows.filter((p: any) => p.status === "confirmado");
        if (confirmados.length === 0) {
          app.logger.warn({ comandaId: comanda_id }, "NFC-e recusada: sem pagamento confirmado");
          return reply.code(400).send({
            error: "Nenhum pagamento confirmado nesta comanda. Confirme o pagamento antes de emitir a NFC-e.",
          });
        }

        const formasBrutas = montarFormasPagamento(confirmados);
        if (formasBrutas.length === 0) {
          return reply.code(400).send({ error: "Valor liquido dos pagamentos confirmados e zero" });
        }

        // 5. Itens
        const pedidoRows = await carregarPedidosFiscais(db, comanda_id, restauranteId, arquivada);
        const pedidosValidos = pedidoRows.filter((p: any) => p.status !== "cancelado");
        if (pedidosValidos.length === 0) {
          return reply.code(400).send({ error: "Comanda sem itens validos para emissao" });
        }

        const pratoIds = Array.from(
          new Set(pedidosValidos.map((p: any) => p.pratoId).filter(Boolean))
        ) as string[];
        const pratoMap = await carregarPratosMap(db, pratoIds, restauranteId);

        const itens = montarItensFiscais(pedidosValidos, pratoMap, restaurante);
        const valorItens = calcularValorItens(itens);
        if (valorItens <= 0) {
          return reply.code(400).send({ error: "Valor total dos itens e zero" });
        }

        const formasPagamento = ajustarFormasPagamento(formasBrutas, valorItens);

        // 6. Numeracao e ambiente
        const numeroNf = await proximoNumeroNfce(db, restauranteId);
        const ambiente: "producao" | "homologacao" =
          restaurante.ambienteFocus === 1 ? "producao" : "homologacao";
        const serieNota = serie ?? 1;

        // 7. Destinatario opcional (CPF na nota)
        let destinatario: DestinatarioInput | undefined;
        if (cpf_destinatario || cnpj_destinatario) {
          destinatario = {};
          if (cpf_destinatario) destinatario.cpf = limparDocumento(cpf_destinatario);
          if (cnpj_destinatario) destinatario.cnpj = limparDocumento(cnpj_destinatario);
          if (nome_destinatario) destinatario.razao_social = nome_destinatario;
          if (email_destinatario) destinatario.email = email_destinatario;
          destinatario.indicador_ie = 9;
        }

        // 8. Payload
        let payload: any;
        try {
          payload = buildNfcePayload(
            restauranteInput,
            itens,
            formasPagamento,
            {
              ambiente,
              serie: serieNota,
              data_emissao_iso: isoBrasilia(new Date()),
              presenca_comprador: presenca_comprador ?? 1,
            },
            destinatario,
            numeroNf
          );
        } catch (buildErr: any) {
          app.logger.warn({ err: buildErr, comandaId: comanda_id }, "Falha ao montar payload NFC-e");
          return reply.code(400).send({ error: buildErr.message });
        }

        // 9. Persiste e envia
        const ref = "nfce-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

        const inserted = await db
          .insert(schema.notasFiscais)
          .values({
            comandaHistoricoId: comanda_id,
            referenciaFocus: ref,
            status: "processando",
            tipoDocumento: "nfce",
            modelo: "65",
            ambiente: restaurante.ambienteFocus,
            serie: serieNota,
            valorTotal: valorItens.toFixed(2),
            destinatarioSnapshot: destinatario ?? null,
            restauranteId,
          })
          .returning();
        const notaFiscal = inserted[0];

        const focusHost =
          process.env.FOCUS_NFE_ENV === "production"
            ? "https://api.focusnfe.com.br"
            : "https://homologacao.focusnfe.com.br";
        const absolutizar = (caminho: any) =>
          typeof caminho === "string" && caminho.startsWith("/")
            ? focusHost + caminho
            : caminho ?? null;

        try {
          const resultado = await focusRequest("POST", "/nfce?ref=" + ref, payload);
          const updateData: any = {};

          if (resultado.status === "autorizado") {
            updateData.status = "autorizada";
            updateData.chaveAcesso = resultado.chave_nfe ?? null;
            updateData.numeroNota = resultado.numero ? parseInt(resultado.numero) : numeroNf;
            updateData.serie = resultado.serie ? parseInt(resultado.serie) : serieNota;
            updateData.protocolo = resultado.protocolo ?? null;
            updateData.danfeUrl = absolutizar(resultado.caminho_danfe);
            updateData.xmlUrl = absolutizar(resultado.caminho_xml_nota_fiscal);
            updateData.mensagemSefaz = resultado.mensagem_sefaz ?? "NFC-e autorizada";
            updateData.emitidaEm = new Date();
          } else if (
            resultado._httpStatus === 202 ||
            resultado.status === "processando_autorizacao"
          ) {
            updateData.status = "processando";
            updateData.mensagemSefaz = "Aguardando autorizacao da SEFAZ";
          } else if (resultado.status === "erro_autorizacao" || resultado.erros) {
            updateData.status = "rejeitada";
            updateData.mensagemSefaz = JSON.stringify(
              resultado.erros ?? resultado.mensagem_sefaz ?? resultado.mensagem ?? resultado
            );
          } else {
            updateData.status = "processando";
            updateData.mensagemSefaz = JSON.stringify(resultado);
          }

          await db
            .update(schema.notasFiscais)
            .set(updateData)
            .where(eq(schema.notasFiscais.id, notaFiscal.id));

          app.logger.info(
            { notaId: notaFiscal.id, status: updateData.status, ref, numeroNf },
            "NFC-e processada"
          );

          return reply.code(200).send({
            ...notaFiscal,
            ...updateData,
            ref,
            valor_produtos: valorItens,
            quantidade_itens: itens.length,
          });
        } catch (focusErr: any) {
          await db
            .update(schema.notasFiscais)
            .set({ status: "erro", mensagemSefaz: String(focusErr.message).slice(0, 500) })
            .where(eq(schema.notasFiscais.id, notaFiscal.id));

          app.logger.error({ err: focusErr, notaId: notaFiscal.id, ref }, "Erro Focus NFe na NFC-e");
          return reply.code(502).send({
            error: "Erro ao comunicar com Focus NFe",
            detail: focusErr.message,
            ref,
          });
        }
      } catch (err: any) {
        app.logger.error({ err }, "Falha ao emitir NFC-e");
        return reply.code(500).send({ error: err.message });
      }
    }
  );
}
