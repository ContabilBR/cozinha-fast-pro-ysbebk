import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role?: string;
}

interface UpdateUserBody {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
  active?: boolean;
}

export function registerUserRoutes(app: App) {
  // GET /api/users - List all users
  app.fastify.get(
    "/api/users",
    {
      schema: {
        description: "List all users",
        tags: ["users"],
        response: {
          200: {
            type: "array",
            items: { type: "object" },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({}, "Listing all users");

        const users = await app.db.select().from(userTable).orderBy(userTable.name);

        return users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          email_verified: u.emailVerified,
          image: u.image,
          role: u.role,
          active: u.active,
          created_at: u.createdAt,
          updated_at: u.updatedAt,
        }));
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list users");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/users - Create new user
  app.fastify.post<{ Body: CreateUserBody }>(
    "/api/users",
    {
      schema: {
        description: "Create a new user",
        tags: ["users"],
        body: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string" },
            role: { type: "string", enum: ["admin", "gerente", "garcom", "cozinheiro"] },
          },
        },
        response: {
          201: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          409: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        if (!request.body.name || !request.body.email || !request.body.password) {
          return reply.status(400).send({ error: "name, email, and password are required" });
        }

        app.logger.info({ email: request.body.email }, "Creating new user");

        // Check if user already exists
        const existing = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.email, request.body.email));

        if (existing.length > 0) {
          return reply.status(409).send({ error: "User with this email already exists" });
        }

        // Use Better Auth signup
        const result = await app.auth.api.signUpEmail({
          body: {
            email: request.body.email,
            password: request.body.password,
            name: request.body.name,
          },
        });

        if (!result.user) {
          return reply.status(400).send({ error: "Failed to create user" });
        }

        // Update role if provided
        if (request.body.role) {
          await app.db
            .update(userTable)
            .set({ role: request.body.role as any })
            .where(eq(userTable.id, result.user.id));
        }

        const created = await app.db.select().from(userTable).where(eq(userTable.id, result.user.id));

        if (!created.length) {
          return reply.status(400).send({ error: "Failed to retrieve created user" });
        }

        const user = created[0];
        app.logger.info({ userId: user.id }, "User created successfully");

        reply.code(201).send({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          active: user.active,
          created_at: user.createdAt,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to create user");
        reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/users/:id - Update user
  app.fastify.put<{ Params: { id: string }; Body: UpdateUserBody }>(
    "/api/users/:id",
    {
      schema: {
        description: "Update user",
        tags: ["users"],
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
            role: { type: "string", enum: ["admin", "gerente", "garcom", "cozinheiro"] },
            active: { type: "boolean" },
          },
        },
        response: {
          200: { type: "object" },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ userId: request.params.id }, "Updating user");

        const existing = await app.db.select().from(userTable).where(eq(userTable.id, request.params.id));

        if (!existing.length) {
          return reply.status(404).send({ error: "User not found" });
        }

        const updates: any = {};
        if (request.body.name !== undefined) updates.name = request.body.name;
        if (request.body.email !== undefined) updates.email = request.body.email;
        if (request.body.role !== undefined) updates.role = request.body.role;
        if (request.body.active !== undefined) updates.active = request.body.active;
        updates.updatedAt = new Date();

        const [updated] = await app.db
          .update(userTable)
          .set(updates)
          .where(eq(userTable.id, request.params.id))
          .returning();

        app.logger.info({ userId: updated.id }, "User updated");

        return {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          active: updated.active,
          created_at: updated.createdAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update user");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/users/:id - Delete (deactivate) user
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/users/:id",
    {
      schema: {
        description: "Delete user",
        tags: ["users"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          204: { description: "User deleted" },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ userId: request.params.id }, "Deleting user");

        const existing = await app.db.select().from(userTable).where(eq(userTable.id, request.params.id));

        if (!existing.length) {
          return reply.status(404).send({ error: "User not found" });
        }

        await app.db
          .update(userTable)
          .set({ active: false, updatedAt: new Date() })
          .where(eq(userTable.id, request.params.id));

        app.logger.info({ userId: request.params.id }, "User deleted");

        return reply.status(204).send();
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete user");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
