import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth } from "../utils/auth.js";

interface UpdateRestauranteBody {
  nome: string;
  filial?: string;
  endereco?: string;
  cnpj?: string;
}

export function registerRestauranteRoutes(app: App) {
  // GET /api/restaurante - Get restaurante info
  app.fastify.get(
    "/api/restaurante",
    {
      schema: {
        description: "Get restaurant information (requires authentication)",
        tags: ["restaurante"],
        response: {
          200: {
            description: "Restaurant information retrieved successfully",
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              nome: { type: "string" },
              filial: { type: ["string", "null"] },
              endereco: { type: ["string", "null"] },
              cnpj: { type: ["string", "null"] },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        app.logger.info({}, "Getting restaurante info");

        const result = await app.db
          .select()
          .from(schema.restaurante)
          .orderBy(schema.restaurante.createdAt)
          .limit(1);

        if (result.length === 0) {
          app.logger.info({}, "No restaurante record found");
          return reply.code(200).send({});
        }

        const restaurante = result[0];

        return reply.code(200).send({
          id: restaurante.id,
          nome: restaurante.nome,
          filial: restaurante.filial,
          endereco: restaurante.endereco,
          cnpj: restaurante.cnpj,
          created_at: restaurante.createdAt.toISOString(),
          updated_at: restaurante.updatedAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get restaurante info");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/restaurante - Update or create restaurante
  app.fastify.put<{ Body: UpdateRestauranteBody }>(
    "/api/restaurante",
    {
      schema: {
        description: "Update or create restaurant information (requires authentication)",
        tags: ["restaurante"],
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string" },
            filial: { type: ["string", "null"] },
            endereco: { type: ["string", "null"] },
            cnpj: { type: ["string", "null"] },
          },
        },
        response: {
          200: {
            description: "Restaurant information updated or created successfully",
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              nome: { type: "string" },
              filial: { type: ["string", "null"] },
              endereco: { type: ["string", "null"] },
              cnpj: { type: ["string", "null"] },
              created_at: { type: "string", format: "date-time" },
              updated_at: { type: "string", format: "date-time" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: UpdateRestauranteBody }>,
      reply: FastifyReply
    ) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        // Validate nome is present
        if (!request.body.nome) {
          return reply.code(400).send({ error: "nome é obrigatório" });
        }

        app.logger.info({ nome: request.body.nome }, "Upserting restaurante");

        // Check if any record exists
        const existing = await app.db
          .select()
          .from(schema.restaurante)
          .orderBy(schema.restaurante.createdAt)
          .limit(1);

        let restaurante;

        if (existing.length > 0) {
          // Update existing record
          const [updated] = await app.db
            .update(schema.restaurante)
            .set({
              nome: request.body.nome,
              filial: request.body.filial,
              endereco: request.body.endereco,
              cnpj: request.body.cnpj,
              updatedAt: new Date(),
            })
            .where(eq(schema.restaurante.id, existing[0].id))
            .returning();

          restaurante = updated;
          app.logger.info({ restauranteId: restaurante.id }, "Restaurante updated successfully");
        } else {
          // Insert new record
          const [created] = await app.db
            .insert(schema.restaurante)
            .values({
              nome: request.body.nome,
              filial: request.body.filial,
              endereco: request.body.endereco,
              cnpj: request.body.cnpj,
            })
            .returning();

          restaurante = created;
          app.logger.info({ restauranteId: restaurante.id }, "Restaurante created successfully");
        }

        return reply.code(200).send({
          id: restaurante.id,
          nome: restaurante.nome,
          filial: restaurante.filial,
          endereco: restaurante.endereco,
          cnpj: restaurante.cnpj,
          created_at: restaurante.createdAt.toISOString(),
          updated_at: restaurante.updatedAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to upsert restaurante");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/restaurante - Delete restaurante
  app.fastify.delete(
    "/api/restaurante",
    {
      schema: {
        description: "Delete restaurant information (requires authentication)",
        tags: ["restaurante"],
        response: {
          200: {
            description: "Restaurant deleted successfully",
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        app.logger.info({}, "Deleting restaurante");

        // Fetch the first record
        const result = await app.db
          .select()
          .from(schema.restaurante)
          .orderBy(schema.restaurante.createdAt)
          .limit(1);

        if (result.length === 0) {
          app.logger.warn({}, "No restaurante record found for deletion");
          return reply.code(404).send({ error: "Nenhum dado cadastrado" });
        }

        const restaurante = result[0];

        // Delete the record
        await app.db
          .delete(schema.restaurante)
          .where(eq(schema.restaurante.id, restaurante.id));

        app.logger.info({ restauranteId: restaurante.id }, "Restaurante deleted successfully");

        return reply.code(200).send({ success: true });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete restaurante");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
