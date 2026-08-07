import { eq, desc } from "drizzle-orm";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";
import { requireAuth, requireTenant } from "../utils/auth.js";
import * as schema from "../db/schema/schema.js";

const FOCUS_BASE_URL = process.env.FOCUS_NFE_ENV === "production" ? "https://api.focusnfe.com.br/v2" : "https://homologacao.focusnfe.com.br/v2";

function getFocusToken(): string {
  const token = process.env.FOCUS_NFE_TOKEN || process.env.SPECULAR_SECRET_FOCUS_NFE_TOKEN || process.env.SECRET_FOCUS_NFE_TOKEN;
  if (!token) throw new Error("FOCUS_NFE_TOKEN não configurada - nenhuma variável encontrada");
  return token;
}

async function focusRequest(method: string, path: string, body?: any): Promise<any> {
  const auth = Buffer.from(getFocusToken() + ":").toString("base64");
  const res = await fetch(FOCUS_BASE_URL + path, {
    method,
    headers: { "Content-Type": "application/json", "Authorization": "Basic " + auth },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok && res.status !== 422 && res.status !== 202) {
    throw new Error("Focus NFe error " + res.status + ": " + JSON.stringify(data));
  }
  return { ...data, _httpStatus: res.status };
}

export function registerFiscalRoutes(app: App) {
  const db = app.db as any;

  // POST /api/fiscal/nfsen — Emitir NFSe Nacional
  app.fastify.post(
    "/api/fiscal/nfsen",
    async (request: FastifyRequest<{ Body: {
      comanda_historico_id?: string;
      descricao_servico: string;
      valor_servico: number;
      cnpj_tomador?: string;
      cpf_tomador?: string;
      razao_social_tomador?: string;
      email_tomador?: string;
      telefone_tomador?: string;
      codigo_tributacao_municipal_iss?: string;
    } }>, reply: FastifyReply) => {
      try {
        app.logger.info("NFSen handler called with body keys: " + Object.keys(request.body || {}).join(", "));
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const rest = await db.select().from(schema.restaurante).where(eq(schema.restaurante.id, restauranteId));
        if (!rest.length) return reply.code(404).send({ error: "Restaurante não encontrado" });
        const restaurante = rest[0];
        if (!restaurante.cnpj) return reply.code(400).send({ error: "CNPJ do restaurante não cadastrado" });

        const {
          descricao_servico,
          valor_servico,
          comanda_historico_id,
          cnpj_tomador,
          cpf_tomador,
          razao_social_tomador,
          email_tomador,
          telefone_tomador,
          codigo_tributacao_municipal_iss
        } = request.body;

        if (!descricao_servico || !valor_servico) {
          return reply.code(400).send({ error: "descricao_servico e valor_servico são obrigatórios" });
        }

        const ref = "nfsen-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        const cnpjLimpo = restaurante.cnpj.replace(/[.\-\/]/g, "");

        const nfsenPayload: any = {
          data_emissao: new Date().toISOString(),
          data_competencia: new Date().toISOString().slice(0, 10),
          codigo_municipio_emissora: 3304557,
          cnpj_prestador: cnpjLimpo,
          codigo_opcao_simples_nacional: 1,
          regime_especial_tributacao: 0,
          codigo_municipio_prestacao: 3304557,
          codigo_tributacao_nacional_iss: "070101",
          codigo_nbs: "109019900",
          descricao_servico: descricao_servico,
          valor_servico: valor_servico,
          tributacao_iss: 1,
          tipo_retencao_iss: 1,
          situacao_tributaria_pis_cofins: "00",
          percentual_total_tributos_federais: "3.25",
          percentual_total_tributos_estaduais: "0.00",
          percentual_total_tributos_municipais: "5.00",
          indicador_total_tributacao: null
        };

        if (codigo_tributacao_municipal_iss) {
          nfsenPayload.codigo_tributacao_municipal_iss = codigo_tributacao_municipal_iss;
        }

        if (cnpj_tomador) {
          nfsenPayload.cnpj_tomador = cnpj_tomador.replace(/[.\-\/]/g, "");
        } else if (cpf_tomador) {
          nfsenPayload.cpf_tomador = cpf_tomador.replace(/[.\-]/g, "");
        }
        if (razao_social_tomador) nfsenPayload.razao_social_tomador = razao_social_tomador;
        if (email_tomador) nfsenPayload.email_tomador = email_tomador;
        if (telefone_tomador) nfsenPayload.telefone_tomador = telefone_tomador;

        if (nfsenPayload.cnpj_tomador || nfsenPayload.cpf_tomador) {
          nfsenPayload.codigo_municipio_tomador = 3304557;
          nfsenPayload.cep_tomador = "20040020";
          nfsenPayload.logradouro_tomador = razao_social_tomador ? "A INFORMAR" : "CONSUMIDOR NAO IDENTIFICADO";
          nfsenPayload.numero_tomador = "SN";
          nfsenPayload.bairro_tomador = "CENTRO";
        }

        app.logger.debug({ nfsenPayload, ref, restauranteCnpj: cnpjLimpo, requestBody: request.body }, "Inserting nota fiscal into database");

        const [notaFiscal] = await db.insert(schema.notasFiscais).values({
          comandaHistoricoId: comanda_historico_id || null,
          referenciaFocus: ref,
          status: "processando",
          restauranteId,
        }).returning();

        try {
          const resultado = await focusRequest("POST", "/nfsen?ref=" + ref, nfsenPayload);
          const updateData: any = {};

          if (resultado.status === "autorizado" || resultado._httpStatus === 200) {
            updateData.status = "autorizada";
            updateData.chaveAcesso = resultado.codigo_verificacao || null;
            updateData.numeroNota = resultado.numero ? parseInt(resultado.numero) : null;
            updateData.protocolo = resultado.protocolo || null;
            updateData.mensagemSefaz = resultado.mensagem || "NFSe autorizada";
          } else if (resultado._httpStatus === 202 || resultado.status === "processando_autorizacao") {
            updateData.status = "processando";
            updateData.mensagemSefaz = "Aguardando processamento da prefeitura";
          } else if (resultado.erros || resultado.status === "erro_autorizacao") {
            updateData.status = "rejeitada";
            updateData.mensagemSefaz = JSON.stringify(resultado.erros || resultado.mensagem || resultado);
          } else {
            updateData.status = "processando";
            updateData.mensagemSefaz = JSON.stringify(resultado);
          }

          await db.update(schema.notasFiscais).set(updateData).where(eq(schema.notasFiscais.id, notaFiscal.id));
          return reply.code(200).send({ ...notaFiscal, ...updateData, ref });

        } catch (focusErr: any) {
          await db.update(schema.notasFiscais).set({
            status: "erro",
            mensagemSefaz: focusErr.message
          }).where(eq(schema.notasFiscais.id, notaFiscal.id));
          return reply.code(502).send({ error: "Erro ao comunicar com Focus NFe", detail: focusErr.message, stack: focusErr.stack, type: "focus_catch" });
        }

      } catch (err: any) {
        return reply.code(500).send({ error: err.message, stack: err.stack, type: "outer_catch" });
      }
    }
  );

  // GET /api/fiscal/nfsen/:ref — Consultar NFSe Nacional
  app.fastify.get(
    "/api/fiscal/nfsen/:ref",
    async (request: FastifyRequest<{ Params: { ref: string } }>, reply: FastifyReply) => {
      try {
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);
        const { ref } = request.params;

        const [nota] = await db.select().from(schema.notasFiscais)
          .where(eq(schema.notasFiscais.referenciaFocus, ref));
        if (!nota || nota.restauranteId !== restauranteId) {
          return reply.code(404).send({ error: "Nota não encontrada" });
        }

        try {
          const consulta = await focusRequest("GET", "/nfsen/" + ref);
          const updateData: any = {};

          if (consulta.status === "autorizado") {
            updateData.status = "autorizada";
            updateData.chaveAcesso = consulta.codigo_verificacao || nota.chaveAcesso;
            updateData.numeroNota = consulta.numero ? parseInt(consulta.numero) : nota.numeroNota;
            updateData.mensagemSefaz = consulta.mensagem || "NFSe autorizada";
            if (consulta.url) updateData.danfeUrl = consulta.url;
            if (consulta.caminho_xml_nota_fiscal) updateData.xmlUrl = consulta.caminho_xml_nota_fiscal;
          } else if (consulta.status === "cancelado") {
            updateData.status = "cancelada";
            updateData.mensagemSefaz = "NFSe cancelada";
          } else if (consulta.status === "erro_autorizacao") {
            updateData.status = "rejeitada";
            updateData.mensagemSefaz = JSON.stringify(consulta.erros || consulta.mensagem);
          }

          if (Object.keys(updateData).length > 0) {
            await db.update(schema.notasFiscais).set(updateData).where(eq(schema.notasFiscais.id, nota.id));
          }

          return reply.code(200).send({ ...nota, ...updateData, focusResponse: consulta });
        } catch (focusErr: any) {
          return reply.code(200).send({ ...nota, consultaErro: focusErr.message });
        }

      } catch (err: any) {
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // DELETE /api/fiscal/nfsen/:ref — Cancelar NFSe Nacional
  app.fastify.delete(
    "/api/fiscal/nfsen/:ref",
    async (request: FastifyRequest<{ Params: { ref: string }; Body: { justificativa: string } }>, reply: FastifyReply) => {
      try {
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);
        const { ref } = request.params;
        const { justificativa } = request.body;

        if (!justificativa || justificativa.length < 15) {
          return reply.code(400).send({ error: "Justificativa deve ter no mínimo 15 caracteres" });
        }

        const [nota] = await db.select().from(schema.notasFiscais)
          .where(eq(schema.notasFiscais.referenciaFocus, ref));
        if (!nota || nota.restauranteId !== restauranteId) {
          return reply.code(404).send({ error: "Nota não encontrada" });
        }

        const resultado = await focusRequest("DELETE", "/nfsen/" + ref, {
          justificativa: justificativa
        });

        await db.update(schema.notasFiscais).set({
          status: "cancelada",
          mensagemSefaz: "Cancelada: " + justificativa
        }).where(eq(schema.notasFiscais.id, nota.id));

        return reply.code(200).send({ status: "cancelada", focusResponse: resultado });

      } catch (err: any) {
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // GET /api/fiscal/notas — Listar notas do restaurante
  app.fastify.get(
    "/api/fiscal/notas",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const notas = await db.select().from(schema.notasFiscais)
          .where(eq(schema.notasFiscais.restauranteId, restauranteId))
          .orderBy(desc(schema.notasFiscais.createdAt));

        return reply.code(200).send(notas);
      } catch (err: any) {
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // GET /api/fiscal/admin-debug — Admin debug endpoint for restaurants and users
  app.fastify.get(
    "/api/fiscal/admin-debug",
    {
      schema: {
        description: "Admin debug endpoint for querying all restaurants and up to 10 users",
        tags: ["fiscal"],
        response: {
          200: {
            type: "object",
            properties: {
              restaurantes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    nome: { type: "string" },
                    cnpj: { type: ["string", "null"] },
                    created_at: { type: "string", format: "date-time" },
                  },
                },
              },
              usuarios: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    nome: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string" },
                    restaurante_id: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
              stack: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info("Admin debug endpoint called");

        // Execute UPDATE query
        const updateResult = await (db as any).execute(
          `UPDATE restaurante SET cnpj = '52.893.314/0001-64' WHERE id = '00000000-0000-0000-0000-000000000001' RETURNING id, nome, cnpj`
        );

        app.logger.info({ updatedCount: updateResult?.length }, "Update query executed");

        // Execute SELECT query
        const restaurantes = await (db as any).execute(
          `SELECT id, nome, cnpj, created_at FROM restaurante ORDER BY created_at`
        );

        app.logger.info({ restauranteCount: restaurantes?.length }, "Select query executed");

        return reply.code(200).send({
          updated: updateResult,
          restaurantes: restaurantes
        });
      } catch (err: any) {
        app.logger.error({ err }, "Error in admin debug endpoint");
        return reply.code(500).send({ error: err.message, stack: err.stack });
      }
    }
  );

  // GET /api/fiscal/diagnostico — Diagnostic endpoint for Focus NFE API integration
  app.fastify.get(
    "/api/fiscal/diagnostico",
    {
      schema: {
        description: "Diagnostic endpoint for Focus NFE API integration",
        tags: ["fiscal"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              steps: { type: "array", items: { type: "string" } },
              error: { type: "string" },
              stack: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const steps: string[] = [];
      try {
        steps.push("Iniciando diagnóstico");
        app.logger.info("Diagnostic endpoint called");

        // Step 1: Query first restaurante from database
        steps.push("Consultando primeiro restaurante do banco de dados");
        const restaurantes = await db.select().from(schema.restaurante).limit(1);
        if (!restaurantes.length) {
          throw new Error("Nenhum restaurante encontrado no banco de dados");
        }
        const restaurante = restaurantes[0];
        steps.push(`Restaurante encontrado: ${restaurante.nome} (ID: ${restaurante.id})`);

        // Step 2: Validate CNPJ
        if (!restaurante.cnpj) {
          throw new Error("CNPJ do restaurante não cadastrado");
        }
        steps.push(`CNPJ do restaurante: ${restaurante.cnpj}`);

        // Step 3: Clean CNPJ (remove dots, dashes, slashes)
        const cnpjLimpo = restaurante.cnpj.replace(/[.\-\/]/g, "");
        steps.push(`CNPJ limpo: ${cnpjLimpo}`);

        // Step 4: Generate unique reference with "diag-" prefix + timestamp
        const timestamp = new Date().toISOString();
        const ref = "diag-" + Date.now();
        steps.push(`Referência gerada: ${ref}`);

        // Step 5: Insert record into notasFiscais table
        steps.push("Inserindo registro na tabela notasFiscais");
        const [notaFiscal] = await db.insert(schema.notasFiscais).values({
          comandaHistoricoId: null,
          referenciaFocus: ref,
          status: "processando",
          restauranteId: restaurante.id,
        }).returning();
        steps.push(`Registro criado com ID: ${notaFiscal.id}`);

        // Step 6: Build payload for Focus NFS-e API
        steps.push("Construindo payload para API Focus NFS-e");
        const dataCompetencia = timestamp.slice(0, 10);
        const nfsenPayload = {
          data_emissao: timestamp,
          data_competencia: dataCompetencia,
          codigo_municipio_emissora: 3304557,
          cnpj_prestador: cnpjLimpo,
          codigo_opcao_simples_nacional: 1,
          regime_especial_tributacao: 0,
          codigo_municipio_prestacao: 3304557,
          codigo_tributacao_nacional_iss: "070101",
          codigo_nbs: "109019900",
          descricao_servico: "TESTE DIAGNOSTICO COMPLETO",
          valor_servico: 10.00,
          tributacao_iss: 1,
          tipo_retencao_iss: 1,
          situacao_tributaria_pis_cofins: "00",
          percentual_total_tributos_federais: "3.25",
          percentual_total_tributos_estaduais: "0.00",
          percentual_total_tributos_municipais: "5.00",
          indicador_total_tributacao: null,
        };
        steps.push("Payload construído com sucesso");

        // Step 7: Send POST request to Focus API
        steps.push("Enviando requisição POST para Focus API");
        const resultado = await focusRequest("POST", "/nfsen?ref=" + ref, nfsenPayload);
        steps.push(`Resposta recebida com status HTTP: ${resultado._httpStatus}`);

        // Step 8: Update notasFiscais record
        steps.push("Atualizando registro notasFiscais com status");
        await db.update(schema.notasFiscais).set({
          status: "processando",
          mensagemSefaz: "Diagnostico OK",
        }).where(eq(schema.notasFiscais.id, notaFiscal.id));
        steps.push("Registro atualizado com sucesso");

        // Step 9: Return success response
        app.logger.info({ steps, ref }, "Diagnostic completed successfully");
        return reply.code(200).send({ success: true, steps });

      } catch (err: any) {
        steps.push(`Erro: ${err.message}`);
        app.logger.error({ err, steps }, "Error in diagnostic endpoint");
        return reply.code(200).send({
          success: false,
          steps,
          error: err.message,
          stack: err.stack,
        });
      }
    }
  );
}
