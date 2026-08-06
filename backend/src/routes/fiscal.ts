import { eq, and } from "drizzle-orm";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth, requireTenant } from "../utils/auth.js";
import * as schema from "../db/schema/schema.js";

// === Focus NFe Service ===
const FOCUS_BASE_URL = process.env.FOCUS_NFE_ENV === "production" ? "https://api.focusnfe.com.br/v2" : "https://homologacao.focusnfe.com.br/v2";

function getFocusToken(): string {
  const token = process.env.FOCUS_NFE_TOKEN || process.env.SPECULAR_SECRET_FOCUS_NFE_TOKEN || process.env.SECRET_FOCUS_NFE_TOKEN;
  if (!token) throw new Error("FOCUS_NFE_TOKEN não configurada - nenhuma variável encontrada");
  return token;
}

async function focusRequest(method: string, path: string, body?: any): Promise<any> {
  const auth = Buffer.from(getFocusToken() + ":").toString("base64");
  const res = await fetch(FOCUS_BASE_URL + path, { method, headers: { "Content-Type": "application/json", "Authorization": "Basic " + auth }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok && res.status !== 422) { throw new Error("Focus NFe error " + res.status + ": " + JSON.stringify(data)); }
  return data;
}
// === Fim Focus NFe Service ===

export function registerFiscalRoutes(app: App) {
  const db = app.db as any;

  // GET /api/fiscal/diagnostico — NFSe Nacional diagnostic endpoint (no auth required)
  app.fastify.get(
    "/api/fiscal/diagnostico",
    {
      schema: {
        description: "Diagnostic endpoint for NFSe Nacional tax invoice API connection testing",
        tags: ["fiscal"],
        response: {
          200: {
            type: "object",
            properties: {
              timestamp: { type: "string", format: "date-time" },
              tipo: { type: "string" },
              ref: { type: "string" },
              cnpj: { type: "string" },
              tokenLength: { type: "number", nullable: true },
              first3Chars: { type: "string", nullable: true },
              last3Chars: { type: "string", nullable: true },
              firstAttemptUrl: { type: "string" },
              firstAttemptStatus: { type: "number", nullable: true },
              firstAttemptBody: { type: "string", nullable: true },
              secondAttemptUrl: { type: "string", nullable: true },
              secondAttemptStatus: { type: "number", nullable: true },
              secondAttemptBody: { type: "string", nullable: true },
              error: { type: "string", nullable: true },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const timestamp = new Date().toISOString();
      app.logger.info({}, "Fiscal diagnostico NFSe Nacional endpoint called");

      try {
        // Read token from environment variables
        let token: string | undefined;
        const varNames = [
          "FOCUS_NFE_TOKEN",
          "SPECULAR_SECRET_FOCUS_NFE_TOKEN",
          "SECRET_FOCUS_NFE_TOKEN",
        ];
        for (const varName of varNames) {
          const val = process.env[varName];
          if (val) {
            token = val;
            break;
          }
        }

        const tokenLength = token ? token.length : null;
        const first3Chars = token ? token.slice(0, 3) : null;
        const last3Chars = token ? token.slice(-3) : null;

        // Generate unique references
        const ref1 = "diag-nfsen-" + Date.now();
        const ref2 = "diag-nfsen2-" + Date.now();
        const cnpj = "52893314000164";

        // Get current date
        const now = new Date();
        const currentDate = now.toISOString().split("T")[0];

        // Prepare NFSe payload
        const nfsePayload = {
          data_emissao: currentDate,
          data_competencia: currentDate,
          codigo_municipio_emissora: 3304557,
          cnpj_prestador: "52893314000164",
          codigo_opcao_simples_nacional: 1,
          regime_especial_tributacao: 0,
          cnpj_tomador: "52893314000164",
          razao_social_tomador: "CONSUMIDOR TESTE HOMOLOGACAO",
          codigo_municipio_tomador: 3304557,
          cep_tomador: "20040020",
          logradouro_tomador: "RUA TESTE",
          numero_tomador: "100",
          bairro_tomador: "CENTRO",
          codigo_municipio_prestacao: 3304557,
          codigo_tributacao_nacional_iss: "070101",
          codigo_nbs: "109019900",
          descricao_servico:
            "FORNECIMENTO DE ALIMENTACAO - NOTA EMITIDA EM AMBIENTE DE HOMOLOGACAO SEM VALOR FISCAL",
          valor_servico: 10.0,
          tributacao_iss: 1,
          tipo_retencao_iss: 1,
          situacao_tributaria_pis_cofins: "00",
          percentual_total_tributos_federais: "3.25",
          percentual_total_tributos_estaduais: "0.00",
          percentual_total_tributos_municipais: "5.00",
          indicador_total_tributacao: null,
        };

        const firstAttemptUrl = `https://api.focusnfe.com.br/v2/nfsen?ref=${ref1}`;
        let firstAttemptStatus: number | null = null;
        let firstAttemptBody: string | null = null;
        let error: string | null = null;

        let secondAttemptUrl: string | null = null;
        let secondAttemptStatus: number | null = null;
        let secondAttemptBody: string | null = null;

        // First attempt: production API
        if (token) {
          try {
            const auth = Buffer.from(token + ":").toString("base64");
            const response = await fetch(firstAttemptUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Basic " + auth,
              },
              body: JSON.stringify(nfsePayload),
            });

            firstAttemptStatus = response.status;
            firstAttemptBody = await response.text();
            if (firstAttemptBody.length > 500) {
              firstAttemptBody = firstAttemptBody.slice(0, 500) + "...";
            }

            // If 401 or 403, make second attempt to homologacao
            if (response.status === 401 || response.status === 403) {
              secondAttemptUrl = `https://homologacao.focusnfe.com.br/v2/nfsen?ref=${ref2}`;
              try {
                const response2 = await fetch(secondAttemptUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: "Basic " + auth,
                  },
                  body: JSON.stringify(nfsePayload),
                });

                secondAttemptStatus = response2.status;
                secondAttemptBody = await response2.text();
                if (secondAttemptBody.length > 500) {
                  secondAttemptBody = secondAttemptBody.slice(0, 500) + "...";
                }
              } catch (err2) {
                error = (err2 as any).message || String(err2);
              }
            }

            app.logger.info(
              { ref: ref1, status: firstAttemptStatus, secondAttempt: secondAttemptStatus },
              "Fiscal diagnostico NFSe Nacional completed"
            );
          } catch (err) {
            error = (err as any).message || String(err);
            app.logger.error({ err }, "Fiscal diagnostico NFSe Nacional failed");
          }
        }

        const diagnostic = {
          timestamp,
          tipo: "NFSe Nacional",
          ref: ref1,
          cnpj,
          tokenLength,
          first3Chars,
          last3Chars,
          firstAttemptUrl,
          firstAttemptStatus,
          firstAttemptBody,
          secondAttemptUrl,
          secondAttemptStatus,
          secondAttemptBody,
          error,
        };

        return reply.code(200).send(diagnostic);
      } catch (err) {
        app.logger.error({ err }, "Fiscal diagnostico NFSe Nacional failed");
        return reply.code(200).send({
          timestamp: new Date().toISOString(),
          tipo: "NFSe Nacional",
          ref: "",
          cnpj: "52893314000164",
          tokenLength: null,
          first3Chars: null,
          last3Chars: null,
          firstAttemptUrl: "https://api.focusnfe.com.br/v2/nfsen?ref=",
          firstAttemptStatus: null,
          firstAttemptBody: null,
          secondAttemptUrl: null,
          secondAttemptStatus: null,
          secondAttemptBody: null,
          error: (err as any).message || "Unknown error",
        });
      }
    }
  );

  // POST /api/fiscal/nfce — emitir NFC-e para uma comanda fechada
  app.fastify.post<{ Body: { comanda_historico_id?: string; itens: Array<{ descricao: string; ncm: string; cfop: string; quantidade: number; valor_unitario: number; icms_situacao_tributaria: string; pis_situacao_tributaria: string; cofins_situacao_tributaria: string }>; cpf_consumidor?: string } }>(
    "/api/fiscal/nfce",
    async (request: FastifyRequest<{ Body: { comanda_historico_id?: string; itens: Array<{ descricao: string; ncm: string; cfop: string; quantidade: number; valor_unitario: number; icms_situacao_tributaria: string; pis_situacao_tributaria: string; cofins_situacao_tributaria: string }>; cpf_consumidor?: string } }>, reply: FastifyReply) => {
      try {
        const authUser = await customRequireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        // Buscar dados do restaurante
        const rest = await db.select().from(schema.restaurante).where(eq(schema.restaurante.id, restauranteId));
        if (!rest.length) return reply.code(404).send({ error: "Restaurante não encontrado" });
        const restaurante = rest[0];
        if (!restaurante.cnpj) return reply.code(400).send({ error: "CNPJ do restaurante não cadastrado. Configure antes de emitir NFC-e." });

        const { itens, cpf_consumidor, comanda_historico_id } = request.body;
        if (!itens || itens.length === 0) return reply.code(400).send({ error: "Informe pelo menos um item" });

        // Gerar referência única
        const ref = "nfce-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

        // Montar payload Focus NFe
        const totalNota = itens.reduce((sum: number, item: any) => sum + (item.quantidade * item.valor_unitario), 0);

        const nfcePayload: any = {
          natureza_operacao: "VENDA AO CONSUMIDOR",
          forma_pagamento: "0",
          tipo_documento: "1",
          finalidade_emissao: "1",
          consumidor_final: "1",
          presenca_comprador: "1",
          modalidade_frete: "9",
          cnpj_emitente: restaurante.cnpj.replace(/[.\-\/]/g, ""),
          items: itens.map((item: any, index: number) => ({
            numero_item: index + 1,
            codigo_produto: (index + 1).toString(),
            descricao: item.descricao,
            codigo_ncm: item.ncm,
            cfop: item.cfop,
            unidade_comercial: "UN",
            quantidade_comercial: item.quantidade.toFixed(4),
            valor_unitario_comercial: item.valor_unitario.toFixed(10),
            valor_bruto: (item.quantidade * item.valor_unitario).toFixed(2),
            unidade_tributavel: "UN",
            quantidade_tributavel: item.quantidade.toFixed(4),
            valor_unitario_tributavel: item.valor_unitario.toFixed(10),
            icms_situacao_tributaria: item.icms_situacao_tributaria,
            icms_origem: "0",
            pis_situacao_tributaria: item.pis_situacao_tributaria,
            cofins_situacao_tributaria: item.cofins_situacao_tributaria,
          })),
          formas_pagamento: [{
            forma_pagamento: "01",
            valor_pagamento: totalNota.toFixed(2),
          }],
        };

        if (cpf_consumidor) {
          const cpfLimpo = cpf_consumidor.replace(/[.\-\/]/g, "");
          if (cpfLimpo.length <= 11) {
            nfcePayload.cpf_destinatario = cpfLimpo;
          } else {
            nfcePayload.cnpj_destinatario = cpfLimpo;
          }
        }

        // Salvar registro local
        const [notaFiscal] = await db.insert(schema.notasFiscais).values({
          comandaHistoricoId: comanda_historico_id || null,
          referenciaFocus: ref,
          status: "processando",
          restauranteId,
        }).returning();

        // Enviar para Focus NFe
        try {
          const resultado = await focusRequest("POST", "/nfce?ref=" + ref, nfcePayload);

          // Atualizar com resposta
          const updateData: any = { mensagemSefaz: resultado.mensagem_sefaz || resultado.mensagem || null };

          if (resultado.status === "autorizado" || resultado.status_sefaz === "100") {
            updateData.status = "autorizada";
            updateData.chaveAcesso = resultado.chave_nfe || null;
            updateData.numeroNota = resultado.numero ? parseInt(resultado.numero) : null;
            updateData.serie = resultado.serie ? parseInt(resultado.serie) : null;
            updateData.protocolo = resultado.protocolo || null;
          } else if (resultado.status === "erro_autorizacao" || resultado.erros) {
            updateData.status = "rejeitada";
            updateData.mensagemSefaz = JSON.stringify(resultado.erros || resultado.mensagem_sefaz);
          } else {
            updateData.status = "processando";
          }

          await db.update(schema.notasFiscais).set(updateData).where(eq(schema.notasFiscais.id, notaFiscal.id));

          // Consultar para obter URLs do XML e DANFE
          if (updateData.status === "autorizada") {
            try {
              const consulta = await focusRequest("GET", "/nfce/" + ref);
              if (consulta.caminho_xml_nota_fiscal || consulta.caminho_danfe) {
                await db.update(schema.notasFiscais).set({
                  xmlUrl: consulta.caminho_xml_nota_fiscal || null,
                  danfeUrl: consulta.caminho_danfe || null,
                }).where(eq(schema.notasFiscais.id, notaFiscal.id));
              }
            } catch (e) {
              app.logger.warn("Não foi possível obter URLs da nota autorizada");
            }
          }

          // Buscar registro atualizado
          const [notaAtualizada] = await db.select().from(schema.notasFiscais).where(eq(schema.notasFiscais.id, notaFiscal.id));
          return reply.code(201).send({ nota_fiscal: notaAtualizada, focus_response: resultado });

        } catch (err) {
          await db.update(schema.notasFiscais).set({ status: "erro", mensagemSefaz: (err as any).message }).where(eq(schema.notasFiscais.id, notaFiscal.id));
          app.logger.error({ error: (err as any).message }, "Erro ao emitir NFC-e");
          return reply.code(502).send({ error: "Erro ao comunicar com Focus NFe", detalhe: (err as any).message });
        }

      } catch (err) {
        app.logger.error({ error: (err as any).message }, "Erro ao emitir NFC-e");
        return reply.code(500).send({ error: "Erro interno do servidor" });
      }
    }
  );

  // GET /api/fiscal/nfce/:ref — consultar status de uma NFC-e
  app.fastify.get<{ Params: { ref: string } }>(
    "/api/fiscal/nfce/:ref",
    async (request: FastifyRequest<{ Params: { ref: string } }>, reply: FastifyReply) => {
      try {
        const authUser = await customRequireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const nota = await db.select().from(schema.notasFiscais).where(and(eq(schema.notasFiscais.referenciaFocus, request.params.ref), eq(schema.notasFiscais.restauranteId, restauranteId)));
        if (!nota.length) return reply.code(404).send({ error: "Nota fiscal não encontrada" });

        // Se ainda processando, consultar Focus NFe
        if (nota[0].status === "processando") {
          try {
            const consulta = await focusRequest("GET", "/nfce/" + request.params.ref);
            const updateData: any = {};
            if (consulta.status === "autorizado") {
              updateData.status = "autorizada";
              updateData.chaveAcesso = consulta.chave_nfe || null;
              updateData.protocolo = consulta.protocolo || null;
              updateData.xmlUrl = consulta.caminho_xml_nota_fiscal || null;
              updateData.danfeUrl = consulta.caminho_danfe || null;
            } else if (consulta.status === "erro_autorizacao") {
              updateData.status = "rejeitada";
              updateData.mensagemSefaz = consulta.mensagem_sefaz || null;
            }
            if (Object.keys(updateData).length > 0) {
              await db.update(schema.notasFiscais).set(updateData).where(eq(schema.notasFiscais.id, nota[0].id));
            }
            const [notaAtualizada] = await db.select().from(schema.notasFiscais).where(eq(schema.notasFiscais.id, nota[0].id));
            return reply.code(200).send({ nota_fiscal: notaAtualizada });
          } catch (e) {
            return reply.code(200).send({ nota_fiscal: nota[0], aviso: "Não foi possível atualizar status junto ao Focus NFe" });
          }
        }

        return reply.code(200).send({ nota_fiscal: nota[0] });
      } catch (err) {
        app.logger.error({ error: (err as any).message }, "Erro ao consultar NFC-e");
        return reply.code(500).send({ error: "Erro interno do servidor" });
      }
    }
  );

  // DELETE /api/fiscal/nfce/:ref — cancelar NFC-e
  app.fastify.delete<{ Params: { ref: string }; Body: { justificativa: string } }>(
    "/api/fiscal/nfce/:ref",
    async (request: FastifyRequest<{ Params: { ref: string }; Body: { justificativa: string } }>, reply: FastifyReply) => {
      try {
        const authUser = await customRequireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const nota = await db.select().from(schema.notasFiscais).where(and(eq(schema.notasFiscais.referenciaFocus, request.params.ref), eq(schema.notasFiscais.restauranteId, restauranteId)));
        if (!nota.length) return reply.code(404).send({ error: "Nota fiscal não encontrada" });
        if (nota[0].status !== "autorizada") return reply.code(400).send({ error: "Apenas notas autorizadas podem ser canceladas" });

        const justificativa = (request.body as any)?.justificativa;
        if (!justificativa || justificativa.length < 15) return reply.code(400).send({ error: "Justificativa deve ter pelo menos 15 caracteres" });

        const resultado = await focusRequest("DELETE", "/nfce/" + request.params.ref, { justificativa });

        await db.update(schema.notasFiscais).set({ status: "cancelada", motivoCancelamento: justificativa }).where(eq(schema.notasFiscais.id, nota[0].id));

        return reply.code(200).send({ success: true, message: "NFC-e cancelada", focus_response: resultado });
      } catch (err) {
        app.logger.error({ error: (err as any).message }, "Erro ao cancelar NFC-e");
        return reply.code(500).send({ error: "Erro interno do servidor" });
      }
    }
  );

  // GET /api/fiscal/notas — listar notas fiscais do restaurante
  app.fastify.get(
    "/api/fiscal/notas",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authUser = await customRequireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const notas = await db.select().from(schema.notasFiscais).where(eq(schema.notasFiscais.restauranteId, restauranteId)).orderBy(schema.notasFiscais.createdAt);

        return reply.code(200).send({ notas });
      } catch (err) {
        app.logger.error({ error: (err as any).message }, "Erro ao listar notas");
        return reply.code(500).send({ error: "Erro interno do servidor" });
      }
    }
  );
}
