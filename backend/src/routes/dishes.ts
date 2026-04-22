import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth, requireRole } from "../utils/auth.js";

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
  categoria_id?: string;
  imagemUrl?: string;
  imagem_url?: string;
  disponivel?: boolean;
}

// Helper function to normalize decimal values (comma to dot)
function normalizeDecimal(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value.replace(',', '.'));
  return value;
}

export function registerDishRoutes(app: App) {
  // GET /api/pratos - List all available pratos with categoria
  app.fastify.get(
    "/api/pratos",
    {
      schema: {
        description: "List all available pratos (disponivel = true) with categoria",
        tags: ["pratos"],
        response: {
          200: {
            type: "object",
            properties: {
              pratos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    nome: { type: "string" },
                    descricao: { type: ["string", "null"] },
                    preco: { type: "string" },
                    imagem_url: { type: ["string", "null"] },
                    disponivel: { type: "boolean" },
                    categoria_id: { type: ["string", "null"] },
                    categoria: {
                      type: ["object", "null"],
                      properties: {
                        nome: { type: "string" },
                      },
                    },
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
        app.logger.info({}, "Listing available pratos");

        // Query available pratos with categoria
        const pratos = await app.db
          .select({
            id: schema.pratos.id,
            nome: schema.pratos.nome,
            descricao: schema.pratos.descricao,
            preco: schema.pratos.preco,
            categoriaId: schema.pratos.categoriaId,
            imagemUrl: schema.pratos.imagemUrl,
            disponivel: schema.pratos.disponivel,
            categoriaNome: schema.categorias.nome,
          })
          .from(schema.pratos)
          .leftJoin(schema.categorias, eq(schema.pratos.categoriaId, schema.categorias.id))
          .where(eq(schema.pratos.disponivel, true))
          .orderBy(schema.pratos.nome);

        app.logger.info({ count: pratos.length }, "Listed available pratos");

        return reply.code(200).send({
          pratos: pratos.map((p) => ({
            id: p.id,
            nome: p.nome,
            descricao: p.descricao,
            preco: p.preco,
            imagem_url: p.imagemUrl,
            disponivel: p.disponivel,
            categoria_id: p.categoriaId,
            categoria: p.categoriaNome ? { nome: p.categoriaNome } : null,
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list available pratos");
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
              prato: {
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
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreatePratoBody }>, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      if (!requireRole(authUser, ["administrador", "gerente"], reply)) return;

      try {
        if (!request.body.nome || !request.body.preco) {
          return reply.code(400).send({ error: "nome and preco are required" });
        }

        app.logger.info({ nome: request.body.nome }, "Creating prato");

        const normalizedPreco = normalizeDecimal(request.body.preco);

        const [prato] = await app.db
          .insert(schema.pratos)
          .values({
            nome: request.body.nome,
            descricao: request.body.descricao,
            preco: normalizedPreco.toString(),
            categoriaId: request.body.categoriaId,
            imagemUrl: request.body.imagemUrl,
            disponivel: request.body.disponivel !== false,
          })
          .returning();

        app.logger.info({ pratoId: prato.id }, "Prato created successfully");

        return reply.code(201).send({
          prato: {
            id: prato.id,
            nome: prato.nome,
            descricao: prato.descricao,
            preco: prato.preco,
            categoriaId: prato.categoriaId,
            imagemUrl: prato.imagemUrl,
            disponivel: prato.disponivel,
            createdAt: prato.createdAt.toISOString(),
          },
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
              prato: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  nome: { type: "string" },
                  descricao: { type: ["string", "null"] },
                  preco: { type: "string" },
                  categoriaId: { type: ["string", "null"] },
                  categoria: {
                    type: ["object", "null"],
                    properties: {
                      id: { type: "string", format: "uuid" },
                      nome: { type: "string" },
                    },
                  },
                  imagemUrl: { type: ["string", "null"] },
                  disponivel: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      try {
        app.logger.info({ pratoId: request.params.id }, "Getting prato");

        const pratos = await app.db
          .select({
            id: schema.pratos.id,
            nome: schema.pratos.nome,
            descricao: schema.pratos.descricao,
            preco: schema.pratos.preco,
            categoriaId: schema.pratos.categoriaId,
            categoriaIdFromJoin: schema.categorias.id,
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
          prato: {
            id: p.id,
            nome: p.nome,
            descricao: p.descricao,
            preco: p.preco,
            categoriaId: p.categoriaId,
            categoria: p.categoriaIdFromJoin ? {
              id: p.categoriaIdFromJoin,
              nome: p.categoriaNome,
            } : null,
            imagemUrl: p.imagemUrl,
            disponivel: p.disponivel,
            createdAt: p.createdAt.toISOString(),
          },
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
            categoria_id: { type: ["string", "null"] },
            imagemUrl: { type: ["string", "null"] },
            imagem_url: { type: ["string", "null"] },
            disponivel: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              prato: {
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
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      if (!requireRole(authUser, ["administrador", "gerente"], reply)) return;

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
        if (request.body.preco !== undefined) updates.preco = normalizeDecimal(request.body.preco).toString();
        const categoriaId = request.body.categoriaId !== undefined ? request.body.categoriaId : request.body.categoria_id;
        if (categoriaId !== undefined) updates.categoriaId = categoriaId;
        const imagemUrl = request.body.imagemUrl || request.body.imagem_url;
        if (imagemUrl !== undefined) updates.imagemUrl = imagemUrl;
        if (request.body.disponivel !== undefined) updates.disponivel = request.body.disponivel;

        const [updated] = await app.db
          .update(schema.pratos)
          .set(updates)
          .where(eq(schema.pratos.id, request.params.id))
          .returning();

        app.logger.info({ pratoId: updated.id }, "Prato updated successfully");

        return reply.code(200).send({
          prato: {
            id: updated.id,
            nome: updated.nome,
            descricao: updated.descricao,
            preco: updated.preco,
            categoriaId: updated.categoriaId,
            imagemUrl: updated.imagemUrl,
            disponivel: updated.disponivel,
            createdAt: updated.createdAt.toISOString(),
          },
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
        description: "Delete a prato (requires authentication and admin/gerente role)",
        tags: ["pratos"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          204: { description: "Prato deleted successfully" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      if (!requireRole(authUser, ["administrador", "gerente"], reply)) return;

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

        return reply.code(204).send();
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete prato");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/pratos/:id/foto - Upload photo for a prato
  app.fastify.post<{ Params: { id: string } }>(
    "/api/pratos/:id/foto",
    {
      schema: {
        description: "Upload a photo for a prato (requires authentication and admin/gerente/cozinheiro role)",
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
              imagem_url: { type: ["string", "null"] },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
          413: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      if (!requireRole(authUser, ["administrador", "gerente", "cozinheiro"], reply)) return;

      try {
        app.logger.info({ pratoId: request.params.id }, "Uploading prato photo");

        // Get the file from multipart form data
        const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

        if (!data) {
          app.logger.warn({ pratoId: request.params.id }, "No file provided in upload request");
          return reply.code(400).send({ error: "No file provided" });
        }

        // Check if prato exists
        const existing = await app.db
          .select()
          .from(schema.pratos)
          .where(eq(schema.pratos.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Prato not found" });
        }

        let buffer: Buffer;
        try {
          buffer = await data.toBuffer();
        } catch (error) {
          app.logger.warn({ err: error }, "File too large");
          return reply.code(413).send({ error: "File too large" });
        }

        const mimeType = data.mimetype || "application/octet-stream";
        const ext = mimeType.startsWith("image/") ? mimeType.replace("image/", ".") : ".bin";
        const filename = `pratos/${request.params.id}-${Date.now()}${ext}`;
        const key = filename;

        // Upload to storage
        const uploadedKey = await app.storage.upload(key, buffer);

        // Get signed URL for client access
        const { url } = await app.storage.getSignedUrl(uploadedKey);

        // Update prato with image URL
        const [updated] = await app.db
          .update(schema.pratos)
          .set({ imagemUrl: url })
          .where(eq(schema.pratos.id, request.params.id))
          .returning();

        app.logger.info({ pratoId: request.params.id, url }, "Prato photo uploaded successfully");

        return reply.code(200).send({
          id: updated.id,
          imagem_url: updated.imagemUrl,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to upload prato photo");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
