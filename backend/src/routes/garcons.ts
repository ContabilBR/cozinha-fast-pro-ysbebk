import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { user as userTable, account as accountTable } from "../db/schema/auth-schema.js";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { requireAuth as customRequireAuth, requireRole } from "../utils/auth.js";

interface CreateGarconBody {
  name: string;
  email: string;
  password: string;
}

interface UpdateGarconBody {
  name?: string;
  email?: string;
  password?: string;
  active?: boolean;
}

export function registerGarconRoutes(app: App) {
  // GET /api/garcons - List all garcons
  app.fastify.get(
    "/api/garcons",
    {
      schema: {
        description: "List all garcons (waiters) with role='garcom'",
        tags: ["garcons"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
                role: { type: "string" },
                active: { type: "boolean" },
                created_at: { type: "string", format: "date-time" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      if (!requireRole(session.user, session.profile, ["administrador", "gerente"], reply)) return;

      try {
        app.logger.info({}, "Listing all garcons");

        const garcons = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.role, "garcom"));

        return reply.code(200).send(
          garcons.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: u.active,
            created_at: u.createdAt.toISOString(),
          }))
        );
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list garcons");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/garcons - Create a new garcon
  app.fastify.post<{ Body: CreateGarconBody }>(
    "/api/garcons",
    {
      schema: {
        description: "Create a new garcon (waiter)",
        tags: ["garcons"],
        body: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string" },
              active: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          409: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateGarconBody }>, reply: FastifyReply) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      if (!requireRole(session.user, session.profile, ["administrador", "gerente"], reply)) return;

      try {
        if (!request.body.name || !request.body.email || !request.body.password) {
          return reply.code(400).send({ error: "name, email, and password are required" });
        }

        app.logger.info({ email: request.body.email }, "Creating new garcon");

        // Check if user already exists
        const existing = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.email, request.body.email))
          .limit(1);

        if (existing && existing.length > 0) {
          return reply.code(409).send({ error: "Email already exists" });
        }

        // Create user
        const userId = randomUUID();
        const now = new Date();
        const hashedPassword = await bcrypt.hash(request.body.password, 10);

        await app.db.insert(userTable).values({
          id: userId,
          name: request.body.name,
          email: request.body.email,
          emailVerified: false,
          role: "garcom",
          active: true,
          createdAt: now,
          updatedAt: now,
        });

        // Create account record
        await app.db.insert(accountTable).values({
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId: userId,
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        });

        // Also insert into usuarios table for compatibility
        await app.db.insert(schema.usuarios).values({
          id: randomUUID(),
          nome: request.body.name,
          email: request.body.email,
          role: "garcom",
          createdAt: now,
        });

        app.logger.info({ userId, email: request.body.email }, "Garcon created successfully");

        return reply.code(201).send({
          id: userId,
          name: request.body.name,
          email: request.body.email,
          role: "garcom",
          active: true,
          created_at: now.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to create garcon");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/garcons/:id - Update a garcon
  app.fastify.put<{ Params: { id: string }; Body: UpdateGarconBody }>(
    "/api/garcons/:id",
    {
      schema: {
        description: "Update a garcon (waiter)",
        tags: ["garcons"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string" },
            active: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string" },
              active: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateGarconBody }>,
      reply: FastifyReply
    ) => {
      const session = await customRequireAuth(app, request, reply);
      if (!session) return;

      if (!requireRole(session.user, session.profile, ["administrador", "gerente"], reply)) return;

      try {
        app.logger.info({ userId: request.params.id }, "Updating garcon");

        const existing = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Garcon not found" });
        }

        const updates: any = {};
        if (request.body.name !== undefined) updates.name = request.body.name;
        if (request.body.email !== undefined) updates.email = request.body.email;
        if (request.body.active !== undefined) updates.active = request.body.active;
        updates.updatedAt = new Date();

        const [updated] = await app.db
          .update(userTable)
          .set(updates)
          .where(eq(userTable.id, request.params.id))
          .returning();

        // If password is provided, update it in account table
        if (request.body.password) {
          const hashedPassword = await bcrypt.hash(request.body.password, 10);
          await app.db
            .update(accountTable)
            .set({ password: hashedPassword })
            .where(eq(accountTable.userId, request.params.id));
        }

        app.logger.info({ userId: updated.id }, "Garcon updated successfully");

        return reply.code(200).send({
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          active: updated.active,
          created_at: updated.createdAt.toISOString(),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update garcon");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/garcons/:id - Delete a garcon
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/garcons/:id",
    {
      schema: {
        description: "Delete a garcon (waiter)",
        tags: ["garcons"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
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
        app.logger.info({ userId: request.params.id }, "Deleting garcon");

        const existing = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.id, request.params.id));

        if (!existing.length) {
          return reply.code(404).send({ error: "Garcon not found" });
        }

        await app.db.delete(userTable).where(eq(userTable.id, request.params.id));

        app.logger.info({ userId: request.params.id }, "Garcon deleted successfully");

        return reply.code(200).send({ success: true });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete garcon");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
