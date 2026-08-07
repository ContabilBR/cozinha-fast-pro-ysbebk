import { eq, desc } from "drizzle-orm";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";
import { requireAuth, requireTenant } from "../utils/auth.js";
import * as schema from "../db/schema/schema.js";

function getFocusToken(): string {
  const token = process.env.FOCUS_NFE_TOKEN || process.env.SPECULAR_SECRET_FOCUS_NFE_TOKEN || process.env.SECRET_FOCUS_NFE_TOKEN;
  if (!token) throw new Error("FOCUS_NFE_TOKEN não configurada - nenhuma variável encontrada");
  return token;
}

async function focusRequest(method: string, path: string, body?: any): Promise<any> {
  const baseUrl = process.env.FOCUS_NFE_ENV === "production" ? "https://api.focusnfe.com.br/v2" : "https://homologacao.focusnfe.com.br/v2";
  const auth = Buffer.from(getFocusToken() + ":").toString("base64");
  const res = await fetch(baseUrl + path, {
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

  app.fastify.get("/api/fiscal/diagnostico", async (request: FastifyRequest, reply: FastifyReply) => {
    const steps: string[] = [];
    try {
      app.logger.info("GET /api/fiscal/diagnostico started");

      // 1. Collect diagnostic steps
      const steps_local: string[] = [];

      // 2. Read Focus NFE token from environment variables
      const token = process.env.FOCUS_NFE_TOKEN || process.env.SPECULAR_SECRET_FOCUS_NFE_TOKEN || process.env.SECRET_FOCUS_NFE_TOKEN;
      if (!token) {
        steps_local.push("ERROR: No Focus NFE token found");
        app.logger.error("No Focus NFE token found in env vars");
        return reply.send({ success: false, steps: steps_local, error: "No Focus NFE token configured" });
      }

      // 3. Determine base URL based on FOCUS_NFE_ENV
      const baseUrl = process.env.FOCUS_NFE_ENV === "production" ? "https://api.focusnfe.com.br/v2" : "https://homologacao.focusnfe.com.br/v2";

      // 4. Log env, baseUrl, and token length to steps
      steps_local.push("env=" + (process.env.FOCUS_NFE_ENV || "homologacao"));
      steps_local.push("baseUrl=" + baseUrl);
      steps_local.push("tokenLen=" + token.length);

      // 5. Force-update restaurante CNPJ for seed restaurant
      const seedRestauranteId = '00000000-0000-0000-0000-000000000001';
      try {
        await db.update(schema.restaurante).set({ cnpj: '52.893.314/0001-64' }).where(eq(schema.restaurante.id, seedRestauranteId));
        steps_local.push("Updated seed restaurante CNPJ");
      } catch (updateErr: any) {
        app.logger.debug({ err: updateErr }, "Could not update seed restaurante CNPJ");
        steps_local.push("Seed restaurante CNPJ update skipped");
      }

      // 6. Fetch first restaurante and extract CNPJ
      const restaurants = await db.select().from(schema.restaurante).limit(1);
      if (restaurants.length === 0) {
        steps_local.push("ERROR: No restaurante found");
        app.logger.error("No restaurante found in database");
        return reply.send({ success: false, steps: steps_local, error: "No restaurante found" });
      }

      const restaurante = restaurants[0];
      const cnpj = restaurante.cnpj ? restaurante.cnpj.replace(/[.\-\/]/g, "") : "NONE";
      steps_local.push("cnpj=" + cnpj);

      // 7. Generate unique ref
      const ref = "diag-" + Date.now();

      // 8. Construct Basic auth header
      const auth = Buffer.from(token + ":").toString("base64");

      // 9. Send test NFSe payload to Focus NFE API
      const now = new Date();
      const payload = {
        data_emissao: now.toISOString(),
        data_competencia: now.toISOString().slice(0, 10),
        codigo_municipio_emissora: 3304557,
        cnpj_prestador: cnpj,
        codigo_opcao_simples_nacional: 1,
        regime_especial_tributacao: 0,
        codigo_municipio_prestacao: 3304557,
        codigo_tributacao_nacional_iss: "070101",
        codigo_nbs: "109019900",
        descricao_servico: "TESTE DIAGNOSTICO",
        valor_servico: 10.00,
        tributacao_iss: 1,
        tipo_retencao_iss: 1,
        situacao_tributaria_pis_cofins: "00",
        percentual_total_tributos_federais: "3.25",
        percentual_total_tributos_estaduais: "0.00",
        percentual_total_tributos_municipais: "5.00",
        indicador_total_tributacao: null
      };

      const focusRes = await fetch(baseUrl + "/nfsen?ref=" + ref, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + auth
        },
        body: JSON.stringify(payload)
      });

      // 10. Log response status and first 300 chars of response body to steps
      const responseBody = await focusRes.text();
      steps_local.push("status=" + focusRes.status);
      steps_local.push("body=" + responseBody.slice(0, 300));

      app.logger.info({ status: focusRes.status, bodyLength: responseBody.length }, "Focus API response");

      // 11. Return success based on status 200 or 202
      const success = focusRes.status === 200 || focusRes.status === 202;
      app.logger.info({ success, status: focusRes.status }, "Diagnostic completed");
      return reply.send({ success, steps: steps_local });

    } catch (err: any) {
      app.logger.error({ err }, "Diagnostic error");
      steps.push("ERROR=" + err.message);
      return reply.send({ success: false, steps, error: err.message });
    }
  });

  const errorResponse = {
    type: "object",
    properties: {
      error: { type: "string" },
    },
  };

  const notaFiscalResponse = {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      comandaHistoricoId: { type: "string", format: "uuid", nullable: true },
      referenciaFocus: { type: "string" },
      status: { type: "string", enum: ["processando", "autorizada", "rejeitada", "cancelada", "erro"] },
      restauranteId: { type: "string", format: "uuid" },
      chaveAcesso: { type: "string", nullable: true },
      numeroNota: { type: "integer", nullable: true },
      protocolo: { type: "string", nullable: true },
      mensagemSefaz: { type: "string", nullable: true },
      danfeUrl: { type: "string", nullable: true },
      xmlUrl: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  };

  // POST /api/fiscal/nfsen — Emitir NFSe Nacional
  app.fastify.post(
    "/api/fiscal/nfsen",
    {
      schema: {
        description: "Emit NFSe Nacional (National Service Invoice)",
        tags: ["fiscal"],
        body: {
          type: "object",
          required: ["descricao_servico", "valor_servico"],
          properties: {
            comanda_historico_id: { type: "string", format: "uuid" },
            descricao_servico: { type: "string", description: "Service description" },
            valor_servico: { type: "number", description: "Service amount" },
            cnpj_tomador: { type: "string", description: "Customer CNPJ (for businesses)" },
            cpf_tomador: { type: "string", description: "Customer CPF (for individuals)" },
            razao_social_tomador: { type: "string", description: "Customer legal name" },
            email_tomador: { type: "string", format: "email" },
            telefone_tomador: { type: "string" },
            codigo_tributacao_municipal_iss: { type: "string" },
          },
        },
        response: {
          200: {
            description: "NFSe created successfully",
            ...notaFiscalResponse,
          },
          400: {
            description: "Invalid request",
            ...errorResponse,
          },
          404: {
            description: "Restaurant not found",
            ...errorResponse,
          },
          502: {
            description: "Error communicating with Focus API",
            ...errorResponse,
          },
          500: {
            description: "Internal server error",
            ...errorResponse,
          },
        },
      },
    },
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
        app.logger.info({ bodyKeys: Object.keys(request.body || {}) }, "POST /api/fiscal/nfsen started");
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const rest = await db.select().from(schema.restaurante).where(eq(schema.restaurante.id, restauranteId));
        if (!rest.length) {
          app.logger.warn({ restauranteId }, "Restaurant not found");
          return reply.code(404).send({ error: "Restaurante não encontrado" });
        }
        const restaurante = rest[0];
        if (!restaurante.cnpj) {
          app.logger.warn({ restauranteId }, "Restaurant CNPJ not configured");
          return reply.code(400).send({ error: "CNPJ do restaurante não cadastrado" });
        }

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
          app.logger.warn({ descricao_servico, valor_servico }, "Missing required fields");
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

        app.logger.debug({ ref, restauranteCnpj: cnpjLimpo }, "Inserting nota fiscal into database");

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
          app.logger.info({ notaId: notaFiscal.id, status: updateData.status }, "NFSe created successfully");
          return reply.code(200).send({ ...notaFiscal, ...updateData, ref });

        } catch (focusErr: any) {
          await db.update(schema.notasFiscais).set({
            status: "erro",
            mensagemSefaz: focusErr.message
          }).where(eq(schema.notasFiscais.id, notaFiscal.id));
          app.logger.error({ err: focusErr, notaId: notaFiscal.id }, "Focus API error");
          return reply.code(502).send({ error: "Erro ao comunicar com Focus NFe", detail: focusErr.message });
        }

      } catch (err: any) {
        app.logger.error({ err }, "Failed to create NFSe");
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // GET /api/fiscal/nfsen/:ref — Consultar NFSe Nacional
  app.fastify.get(
    "/api/fiscal/nfsen/:ref",
    {
      schema: {
        description: "Query NFSe Nacional status",
        tags: ["fiscal"],
        params: {
          type: "object",
          required: ["ref"],
          properties: {
            ref: { type: "string", description: "NFSe reference" },
          },
        },
        response: {
          200: {
            description: "NFSe status retrieved successfully",
            ...notaFiscalResponse,
          },
          404: {
            description: "NFSe not found",
            ...errorResponse,
          },
          500: {
            description: "Internal server error",
            ...errorResponse,
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { ref: string } }>, reply: FastifyReply) => {
      try {
        app.logger.info({ ref: request.params.ref }, "GET /api/fiscal/nfsen/:ref started");
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);
        const { ref } = request.params;

        const [nota] = await db.select().from(schema.notasFiscais)
          .where(eq(schema.notasFiscais.referenciaFocus, ref));
        if (!nota || nota.restauranteId !== restauranteId) {
          app.logger.warn({ ref, restauranteId }, "NFSe not found");
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

          app.logger.info({ notaId: nota.id, status: updateData.status || nota.status }, "NFSe status updated");
          return reply.code(200).send({ ...nota, ...updateData, focusResponse: consulta });
        } catch (focusErr: any) {
          app.logger.warn({ err: focusErr, ref }, "Focus query error, returning cached status");
          return reply.code(200).send({ ...nota, consultaErro: focusErr.message });
        }

      } catch (err: any) {
        app.logger.error({ err }, "Failed to query NFSe");
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // DELETE /api/fiscal/nfsen/:ref — Cancelar NFSe Nacional
  app.fastify.delete(
    "/api/fiscal/nfsen/:ref",
    {
      schema: {
        description: "Cancel NFSe Nacional",
        tags: ["fiscal"],
        params: {
          type: "object",
          required: ["ref"],
          properties: {
            ref: { type: "string", description: "NFSe reference" },
          },
        },
        body: {
          type: "object",
          required: ["justificativa"],
          properties: {
            justificativa: { type: "string", minLength: 15, description: "Cancellation justification (min 15 chars)" },
          },
        },
        response: {
          200: {
            description: "NFSe cancelled successfully",
            type: "object",
            properties: {
              status: { type: "string" },
              focusResponse: { type: "object" },
            },
          },
          400: {
            description: "Invalid request",
            ...errorResponse,
          },
          404: {
            description: "NFSe not found",
            ...errorResponse,
          },
          500: {
            description: "Internal server error",
            ...errorResponse,
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { ref: string }; Body: { justificativa: string } }>, reply: FastifyReply) => {
      try {
        app.logger.info({ ref: request.params.ref }, "DELETE /api/fiscal/nfsen/:ref started");
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);
        const { ref } = request.params;
        const { justificativa } = request.body;

        if (!justificativa || justificativa.length < 15) {
          app.logger.warn({ justificativaLength: justificativa?.length }, "Invalid justification");
          return reply.code(400).send({ error: "Justificativa deve ter no mínimo 15 caracteres" });
        }

        const [nota] = await db.select().from(schema.notasFiscais)
          .where(eq(schema.notasFiscais.referenciaFocus, ref));
        if (!nota || nota.restauranteId !== restauranteId) {
          app.logger.warn({ ref, restauranteId }, "NFSe not found for cancellation");
          return reply.code(404).send({ error: "Nota não encontrada" });
        }

        const resultado = await focusRequest("DELETE", "/nfsen/" + ref, {
          justificativa: justificativa
        });

        await db.update(schema.notasFiscais).set({
          status: "cancelada",
          mensagemSefaz: "Cancelada: " + justificativa
        }).where(eq(schema.notasFiscais.id, nota.id));

        app.logger.info({ notaId: nota.id }, "NFSe cancelled successfully");
        return reply.code(200).send({ status: "cancelada", focusResponse: resultado });

      } catch (err: any) {
        app.logger.error({ err }, "Failed to cancel NFSe");
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // GET /api/fiscal/notas — Listar notas do restaurante
  app.fastify.get(
    "/api/fiscal/notas",
    {
      schema: {
        description: "List restaurant notas fiscais",
        tags: ["fiscal"],
        response: {
          200: {
            description: "List of notas fiscais",
            type: "array",
            items: notaFiscalResponse,
          },
          500: {
            description: "Internal server error",
            ...errorResponse,
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info("GET /api/fiscal/notas started");
        const authUser = await requireAuth(app, request, reply);
        if (!authUser) return;
        const restauranteId = requireTenant(authUser);

        const notas = await db.select().from(schema.notasFiscais)
          .where(eq(schema.notasFiscais.restauranteId, restauranteId))
          .orderBy(desc(schema.notasFiscais.createdAt));

        app.logger.info({ count: notas.length }, "Listed notas fiscais");
        return reply.code(200).send(notas);
      } catch (err: any) {
        app.logger.error({ err }, "Failed to list notas fiscais");
        return reply.code(500).send({ error: err.message });
      }
    }
  );
}
