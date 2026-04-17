import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface CreatePratoBody {
  nome: string;
  descricao?: string;
  preco: string;
  categoriaId?: string;
  imagemUrl?: string;
  disponivel?: boolean;
}

interface UpdatePratoBody {
  nome?: string;
  descricao?: string;
  preco?: string;
  categoriaId?: string;
  imagemUrl?: string;
  disponivel?: boolean;
}

export function registerDishRoutes(app: App) {
  // GET /api/pratos - List all pratos
  app.fastify.get(
    "/api/pratos",
    {
      schema: {
        description: "List all pratos (requires authentication)",
        tags: ["pratos"],
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    nome: { type: "string" },
                    descricao: { type: "string" },
                    preco: { type: "string" },
                    categoriaId: { type: "string" },
                    imagemUrl: { type: "string" },
                    disponivel: { type: "boolean" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({}, "Listing pratos");

        const pratos = await app.db
          .select({
            id: schema.pratos.id,
            nome: schema.pratos.nome,
            descricao: schema.pratos.descricao,
            preco: schema.pratos.preco,
            categoriaId: schema.pratos.categoriaId,
            categoriaNome: schema.categorias.nome,
            imagemUrl: schema.pratos.imagemUrl,
            disponivel: schema.pratos.disponivel,
            createdAt: schema.pratos.createdAt,
          })
          .from(schema.pratos)
          .leftJoin(schema.categorias, eq(schema.pratos.categoriaId, schema.categorias.id));

        return reply.code(200).send({
          data: pratos.map((p) => ({
            id: p.id,
            nome: p.nome,
            descricao: p.descricao,
            preco: p.preco,
            categoriaId: p.categoriaId,
            categoriaNome: p.categoriaNome || "Sem categoria",
            imagemUrl: p.imagemUrl,
            disponivel: p.disponivel,
            createdAt: p.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list pratos");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/pratos - Create a new prato
  app.fastify.post<{ Body: CreatePratoBody }>(
    "/api/pratos",
    {
      schema: {
        description: "Create a new prato (requires authentication)",
        tags: ["pratos"],
        body: {
          type: "object",
          required: ["nome", "preco"],
          properties: {
            nome: { type: "string" },
            descricao: { type: ["string", "null"] },
            preco: { type: "string" },
            categoriaId: { type: ["string", "null"] },
            imagemUrl: { type: ["string", "null"] },
            disponivel: { type: "boolean" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              nome: { type: "string" },
              descricao: { type: ["string", "null"] },
              preco: { type: "string" },
              categoriaId: { type: ["string", "null"] },
              imagemUrl: { type: ["string", "null"] },
              disponivel: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreatePratoBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        if (!request.body.nome || !request.body.preco) {
          return reply.code(400).send({ error: "nome and preco are required" });
        }

        app.logger.info({ nome: request.body.nome }, "Creating prato");

        const [prato] = await app.db
          .insert(schema.pratos)
          .values({
            nome: request.body.nome,
            descricao: request.body.descricao,
            preco: request.body.preco,
            categoriaId: request.body.categoriaId,
            imagemUrl: request.body.imagemUrl,
            disponivel: request.body.disponivel !== false,
          })
          .returning();

        app.logger.info({ pratoId: prato.id }, "Prato created successfully");

        return reply.code(201).send({
          id: prato.id,
          nome: prato.nome,
          descricao: prato.descricao,
          preco: prato.preco,
          categoriaId: prato.categoriaId,
          imagemUrl: prato.imagemUrl,
          disponivel: prato.disponivel,
          createdAt: prato.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create prato");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/pratos/:id - Get a prato
  app.fastify.get<{ Params: { id: string } }>(
    "/api/pratos/:id",
    {
      schema: {
        description: "Get a prato by ID (requires authentication)",
        tags: ["pratos"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              nome: { type: "string" },
              descricao: { type: ["string", "null"] },
              preco: { type: "string" },
              categoriaId: { type: ["string", "null"] },
              imagemUrl: { type: ["string", "null"] },
              disponivel: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ pratoId: request.params.id }, "Getting prato");

        const pratos = await app.db
          .select({
            id: schema.pratos.id,
            nome: schema.pratos.nome,
            descricao: schema.pratos.descricao,
            preco: schema.pratos.preco,
            categoriaId: schema.pratos.categoriaId,
            categoriaNome: schema.categorias.nome,
            imagemUrl: schema.pratos.imagemUrl,
            disponivel: schema.pratos.disponivel,
            createdAt: schema.pratos.createdAt,
          })
          .from(schema.pratos)
          .leftJoin(schema.categorias, eq(schema.pratos.categoriaId, schema.categorias.id))
          .where(eq(schema.pratos.id, request.params.id));

        if (!pratos.length) {
          return reply.code(404).send({ error: "Prato not found" });
        }

        const p = pratos[0];
        return reply.code(200).send({
          id: p.id,
          nome: p.nome,
          descricao: p.descricao,
          preco: p.preco,
          categoriaId: p.categoriaId,
          categoriaNome: p.categoriaNome || "Sem categoria",
          imagemUrl: p.imagemUrl,
          disponivel: p.disponivel,
          createdAt: p.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get prato");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/pratos/:id - Update a prato
  app.fastify.put<{ Params: { id: string }; Body: UpdatePratoBody }>(
    "/api/pratos/:id",
    {
      schema: {
        description: "Update a prato (requires authentication)",
        tags: ["pratos"],
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
            preco: { type: "string" },
            categoriaId: { type: ["string", "null"] },
            imagemUrl: { type: ["string", "null"] },
            disponivel: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              nome: { type: "string" },
              descricao: { type: ["string", "null"] },
              preco: { type: "string" },
              categoriaId: { type: ["string", "null"] },
              imagemUrl: { type: ["string", "null"] },
              disponivel: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdatePratoBody }>,
      reply: FastifyReply
    ) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ pratoId: request.params.id }, "Updating prato");

        const existing = await app.db
          .select()
          .from(schema.pratos)
          .where(eq(schema.pratos.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Prato not found" });
        }

        const updates: any = {};
        if (request.body.nome !== undefined) updates.nome = request.body.nome;
        if (request.body.descricao !== undefined) updates.descricao = request.body.descricao;
        if (request.body.preco !== undefined) updates.preco = request.body.preco;
        if (request.body.categoriaId !== undefined) updates.categoriaId = request.body.categoriaId;
        if (request.body.imagemUrl !== undefined) updates.imagemUrl = request.body.imagemUrl;
        if (request.body.disponivel !== undefined) updates.disponivel = request.body.disponivel;

        const [updated] = await app.db
          .update(schema.pratos)
          .set(updates)
          .where(eq(schema.pratos.id, request.params.id))
          .returning();

        app.logger.info({ pratoId: updated.id }, "Prato updated successfully");

        return reply.code(200).send({
          id: updated.id,
          nome: updated.nome,
          descricao: updated.descricao,
          preco: updated.preco,
          categoriaId: updated.categoriaId,
          imagemUrl: updated.imagemUrl,
          disponivel: updated.disponivel,
          createdAt: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update prato");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/pratos/:id - Delete a prato
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/pratos/:id",
    {
      schema: {
        description: "Delete a prato (requires authentication)",
        tags: ["pratos"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            type: "object",
            properties: { message: { type: "string" } },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ pratoId: request.params.id }, "Deleting prato");

        const existing = await app.db
          .select()
          .from(schema.pratos)
          .where(eq(schema.pratos.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Prato not found" });
        }

        await app.db.delete(schema.pratos).where(eq(schema.pratos.id, request.params.id));

        app.logger.info({ pratoId: request.params.id }, "Prato deleted successfully");

        return reply.code(200).send({ message: "Prato excluído com sucesso" });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete prato");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
