import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth, requireRole } from "../utils/auth.js";

interface CreateCategoriaBody {
  nome: string;
  descricao?: string;
}

interface UpdateCategoriaBody {
  nome?: string;
  descricao?: string;
}

export function registerCategoriasRoutes(app: App) {
  // GET /api/categorias - List all categories
  app.fastify.get(
    "/api/categorias",
    {
      schema: {
        description: "List all categorias",
        tags: ["categorias"],
        response: {
          200: {
            type: "object",
            properties: {
              categorias: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    nome: { type: "string" },
                    descricao: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing categorias");

        const result = await app.db
          .select()
          .from(schema.categorias)
          .orderBy(schema.categorias.nome);

        return reply.code(200).send({
          categorias: result.map((c) => ({
            id: c.id,
            nome: c.nome,
            descricao: c.descricao,
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list categorias");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/categorias - Create a new category
  app.fastify.post<{ Body: CreateCategoriaBody }>(
    "/api/categorias",
    {
      schema: {
        description: "Create a new categoria",
        tags: ["categorias"],
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string" },
            descricao: { type: ["string", "null"] },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              categoria: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  nome: { type: "string" },
                  descricao: { type: ["string", "null"] },
                  createdAt: { type: "string" },
                },
              },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateCategoriaBody }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      if (!requireRole(session.user, session.profile, ["administrador", "gerente"], reply)) return;

      try {
        if (!request.body.nome) {
          return reply.code(400).send({ error: "nome is required" });
        }

        app.logger.info({ nome: request.body.nome }, "Creating categoria");

        const [categoria] = await app.db
          .insert(schema.categorias)
          .values({
            nome: request.body.nome,
            descricao: request.body.descricao,
          })
          .returning();

        app.logger.info({ categoriaId: categoria.id }, "Categoria created successfully");

        return reply.code(201).send({
          categoria: {
            id: categoria.id,
            nome: categoria.nome,
            descricao: categoria.descricao,
            createdAt: categoria.createdAt.toISOString(),
          },
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create categoria");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/categorias/:id - Update a category
  app.fastify.put<{ Params: { id: string }; Body: UpdateCategoriaBody }>(
    "/api/categorias/:id",
    {
      schema: {
        description: "Update a categoria",
        tags: ["categorias"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            nome: { type: "string" },
            descricao: { type: ["string", "null"] },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              categoria: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  nome: { type: "string" },
                  descricao: { type: ["string", "null"] },
                  createdAt: { type: "string" },
                },
              },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateCategoriaBody }>,
      reply: FastifyReply
    ) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ categoriaId: request.params.id }, "Updating categoria");

        const existing = await app.db
          .select()
          .from(schema.categorias)
          .where(eq(schema.categorias.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Categoria not found" });
        }

        const updates: any = {};
        if (request.body.nome !== undefined) updates.nome = request.body.nome;
        if (request.body.descricao !== undefined) updates.descricao = request.body.descricao;

        const [updated] = await app.db
          .update(schema.categorias)
          .set(updates)
          .where(eq(schema.categorias.id, request.params.id))
          .returning();

        app.logger.info({ categoriaId: updated.id }, "Categoria updated successfully");

        return reply.code(200).send({
          categoria: {
            id: updated.id,
            nome: updated.nome,
            descricao: updated.descricao,
            createdAt: updated.createdAt.toISOString(),
          },
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update categoria");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/categorias/:id - Delete a category
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/categorias/:id",
    {
      schema: {
        description: "Delete a categoria (requires authentication and admin/gerente role)",
        tags: ["categorias"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          204: { description: "Categoria deleted successfully" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      if (!requireRole(session.user, session.profile, ["administrador", "gerente"], reply)) return;

      try {
        app.logger.info({ categoriaId: request.params.id }, "Deleting categoria");

        const existing = await app.db
          .select()
          .from(schema.categorias)
          .where(eq(schema.categorias.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Categoria not found" });
        }

        await app.db.delete(schema.categorias).where(eq(schema.categorias.id, request.params.id));

        app.logger.info({ categoriaId: request.params.id }, "Categoria deleted successfully");

        return reply.code(204).send();
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete categoria");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
