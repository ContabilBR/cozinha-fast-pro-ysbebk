import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth, requireTenant } from "../utils/auth.js";

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
        const tenantId = requireTenant(authUser);

        // If user has no tenant, return 404
        if (!tenantId) {
          app.logger.warn({}, "User has no tenant for get operation");
          return reply.code(404).send({ error: "Nenhum dado cadastrado" });
        }

        app.logger.info({ tenantId }, "Getting restaurante info");

        const result = await app.db
          .select()
          .from(schema.restaurante)
          .where(eq(schema.restaurante.id, tenantId))
          .limit(1);

        if (result.length === 0) {
          app.logger.info({ tenantId }, "No restaurante record found");
          return reply.code(404).send({ error: "Nenhum dado cadastrado" });
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
        const tenantId = requireTenant(authUser);

        // If user has no tenant, return 404
        if (!tenantId) {
          app.logger.warn({}, "User has no tenant for put operation");
          return reply.code(404).send({ error: "Nenhum dado cadastrado" });
        }

        // Validate nome is present
        if (!request.body.nome) {
          return reply.code(400).send({ error: "nome é obrigatório" });
        }

        app.logger.info({ nome: request.body.nome, tenantId }, "Upserting restaurante");

        // Check if the tenant's restaurante exists
        const existing = await app.db
          .select()
          .from(schema.restaurante)
          .where(eq(schema.restaurante.id, tenantId));

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
            .where(eq(schema.restaurante.id, tenantId))
            .returning();

          restaurante = updated;
          app.logger.info({ restauranteId: restaurante.id }, "Restaurante updated successfully");
        } else {
          // This shouldn't happen in normal flow - tenant must have a restaurante
          app.logger.warn({ tenantId }, "Tenant restaurante not found for update");
          return reply.code(404).send({ error: "Restaurante not found" });
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
        const tenantId = requireTenant(authUser);

        // If user has no tenant, return 404
        if (!tenantId) {
          app.logger.warn({}, "User has no tenant for delete operation");
          return reply.code(404).send({ error: "Nenhum dado cadastrado" });
        }

        app.logger.info({ tenantId }, "Deleting restaurante");

        // Check if the tenant's restaurante exists
        let existing;
        try {
          existing = await app.db
            .select()
            .from(schema.restaurante)
            .where(eq(schema.restaurante.id, tenantId))
            .limit(1);
        } catch (selectError: any) {
          app.logger.error({ err: selectError, tenantId }, "Failed to query restaurante for deletion");
          throw selectError;
        }

        if (!existing || existing.length === 0) {
          app.logger.warn({ tenantId }, "Restaurante not found for deletion");
          return reply.code(404).send({ error: "Nenhum dado cadastrado" });
        }

        // Try to delete the record
        try {
          const deleteResult = await app.db
            .delete(schema.restaurante)
            .where(eq(schema.restaurante.id, tenantId));

          app.logger.info({ restauranteId: tenantId, deleteResult }, "Restaurante deleted successfully");
          return reply.code(200).send({ success: true });
        } catch (deleteError: any) {
          // Handle FK constraint violation - can't delete if referenced by other tables
          // Error code 23503 = Foreign key violation (postgres-js may expose it differently)
          const errorMessage = (deleteError?.message || "").toLowerCase();
          const errorCode = deleteError?.code;
          app.logger.debug({ errorCode, errorMessage, deleteErrorStr: String(deleteError) }, "Delete error details");

          if (errorCode === '23503' || errorCode === 23503 ||
              errorMessage.includes('foreign key') ||
              errorMessage.includes('violates foreign key') ||
              errorMessage.includes('still referenced')) {
            app.logger.warn({ err: deleteError }, "Cannot delete restaurante - has dependent records");
            return reply.code(400).send({ error: "Não é possível deletar restaurante com registros relacionados" });
          }
          throw deleteError;
        }
      } catch (error: any) {
        app.logger.error({ err: error, code: error?.code, message: error?.message, stack: error?.stack }, "Failed to delete restaurante");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
