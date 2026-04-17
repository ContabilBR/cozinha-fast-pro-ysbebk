import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireRole } from "../utils/auth.js";

interface CreateUsuarioBody {
  nome: string;
  email: string;
  senha: string;
  role?: string;
}

interface UpdateUsuarioBody {
  nome?: string;
  email?: string;
  senha?: string;
  role?: string;
}

export function registerUsuariosRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/usuarios - List all usuarios
  app.fastify.get(
    "/api/usuarios",
    {
      schema: {
        description: "List all usuarios",
        tags: ["usuarios"],
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
                    email: { type: "string" },
                    role: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
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
        app.logger.info({}, "Listing usuarios");

        const result = await app.db
          .select({
            id: schema.usuarios.id,
            nome: schema.usuarios.nome,
            email: schema.usuarios.email,
            role: schema.usuarios.role,
            createdAt: schema.usuarios.createdAt,
          })
          .from(schema.usuarios)
          .orderBy(schema.usuarios.nome);

        return reply.code(200).send({
          data: result.map((u) => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list usuarios");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/usuarios - Create a new usuario
  app.fastify.post<{ Body: CreateUsuarioBody }>(
    "/api/usuarios",
    {
      schema: {
        description: "Create a new usuario",
        tags: ["usuarios"],
        body: {
          type: "object",
          required: ["nome", "email", "senha"],
          properties: {
            nome: { type: "string" },
            email: { type: "string", format: "email" },
            senha: { type: "string" },
            role: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              nome: { type: "string" },
              email: { type: "string" },
              role: { type: "string" },
              createdAt: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateUsuarioBody }>, reply: FastifyReply) => {
      try {
        if (!request.body.nome || !request.body.email || !request.body.senha) {
          return reply.code(400).send({ error: "nome, email, and senha are required" });
        }

        app.logger.info({ email: request.body.email }, "Creating usuario");

        const hashedPassword = await bcrypt.hash(request.body.senha, 10);

        const [usuario] = await app.db
          .insert(schema.usuarios)
          .values({
            nome: request.body.nome,
            email: request.body.email,
            senhaHash: hashedPassword,
            role: request.body.role || "garcom",
          })
          .returning();

        app.logger.info({ usuarioId: usuario.id }, "Usuario created successfully");

        return reply.code(201).send({
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          role: usuario.role,
          createdAt: usuario.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create usuario");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/usuarios/:id - Update a usuario
  app.fastify.put<{ Params: { id: string }; Body: UpdateUsuarioBody }>(
    "/api/usuarios/:id",
    {
      schema: {
        description: "Update a usuario",
        tags: ["usuarios"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            nome: { type: "string" },
            email: { type: "string", format: "email" },
            senha: { type: "string" },
            role: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              nome: { type: "string" },
              email: { type: "string" },
              role: { type: "string" },
              createdAt: { type: "string" },
            },
          },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateUsuarioBody }>,
      reply: FastifyReply
    ) => {
      try {
        app.logger.info({ usuarioId: request.params.id }, "Updating usuario");

        const existing = await app.db
          .select()
          .from(schema.usuarios)
          .where(eq(schema.usuarios.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Usuario not found" });
        }

        const updates: any = {};
        if (request.body.nome !== undefined) updates.nome = request.body.nome;
        if (request.body.email !== undefined) updates.email = request.body.email;
        if (request.body.role !== undefined) updates.role = request.body.role;
        if (request.body.senha !== undefined) {
          updates.senhaHash = await bcrypt.hash(request.body.senha, 10);
        }

        const [updated] = await app.db
          .update(schema.usuarios)
          .set(updates)
          .where(eq(schema.usuarios.id, request.params.id))
          .returning();

        app.logger.info({ usuarioId: updated.id }, "Usuario updated successfully");

        return reply.code(200).send({
          id: updated.id,
          nome: updated.nome,
          email: updated.email,
          role: updated.role,
          createdAt: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update usuario");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/usuarios/:id - Delete a usuario
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/usuarios/:id",
    {
      schema: {
        description: "Delete a usuario (requires authentication and admin/gerente role)",
        tags: ["usuarios"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          204: { description: "Usuario deleted successfully" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (!requireRole(session.user, ["administrador", "gerente"], reply)) return;

      try {
        app.logger.info({ usuarioId: request.params.id }, "Deleting usuario");

        const existing = await app.db
          .select()
          .from(schema.usuarios)
          .where(eq(schema.usuarios.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Usuario not found" });
        }

        await app.db.delete(schema.usuarios).where(eq(schema.usuarios.id, request.params.id));

        app.logger.info({ usuarioId: request.params.id }, "Usuario deleted successfully");

        return reply.code(204).send();
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete usuario");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
