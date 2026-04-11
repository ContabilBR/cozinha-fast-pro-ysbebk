import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

interface CreateUserBody {
  email: string;
  password: string;
  name: string;
  role: "garcom" | "administrador" | "gerente" | "cozinheiro";
}

interface UpdateUserBody {
  name?: string;
  role?: "garcom" | "administrador" | "gerente" | "cozinheiro";
  active?: boolean;
}

export function registerUserRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/users - list all users (admin only)
  app.fastify.get(
    "/api/users",
    {
      schema: {
        description: "List all users",
        tags: ["users"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
                role: { type: "string", enum: ["garcom", "administrador", "gerente", "cozinheiro"] },
                active: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: session.user.id }, "Listing all users");

      const users = await app.db.select().from(userTable);
      app.logger.info({ count: users.length }, "Users listed successfully");
      return users;
    }
  );

  // POST /api/users - create user (admin only)
  app.fastify.post<{ Body: CreateUserBody }>(
    "/api/users",
    {
      schema: {
        description: "Create a new user with role",
        tags: ["users"],
        body: {
          type: "object",
          required: ["email", "password", "name", "role"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
            name: { type: "string" },
            role: { type: "string", enum: ["garcom", "administrador", "gerente", "cozinheiro"] },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["garcom", "administrador", "gerente", "cozinheiro"] },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ body: { email: request.body.email, role: request.body.role } }, "Creating new user");

      try {
        const result = await app.auth.api.signUpEmail({
          body: {
            email: request.body.email,
            password: request.body.password,
            name: request.body.name,
          },
        });

        if (!result.user) {
          throw new Error("User creation failed");
        }

        // Update user role
        await app.db.update(userTable).set({ role: request.body.role }).where(eq(userTable.id, result.user.id));

        const createdUser = await app.db.query.user.findFirst({
          where: eq(userTable.id, result.user.id),
        });

        app.logger.info({ userId: result.user.id, role: request.body.role }, "User created successfully");
        return reply.status(201).send(createdUser);
      } catch (error) {
        app.logger.error({ err: error, email: request.body.email }, "Failed to create user");
        return reply.status(400).send({ error: "Failed to create user" });
      }
    }
  );

  // GET /api/users/:id - get user by id
  app.fastify.get<{ Params: { id: string } }>(
    "/api/users/:id",
    {
      schema: {
        description: "Get user by ID",
        tags: ["users"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["garcom", "administrador", "gerente", "cozinheiro"] },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: request.params.id }, "Getting user");

      const user = await app.db.query.user.findFirst({
        where: eq(userTable.id, request.params.id),
      });

      if (!user) {
        app.logger.warn({ userId: request.params.id }, "User not found");
        return reply.status(404).send({ error: "User not found" });
      }

      app.logger.info({ userId: user.id }, "User retrieved successfully");
      return user;
    }
  );

  // PUT /api/users/:id - update user
  app.fastify.put<{ Params: { id: string }; Body: UpdateUserBody }>(
    "/api/users/:id",
    {
      schema: {
        description: "Update user",
        tags: ["users"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string", enum: ["garcom", "administrador", "gerente", "cozinheiro"] },
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
              role: { type: "string", enum: ["garcom", "administrador", "gerente", "cozinheiro"] },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: request.params.id, body: request.body }, "Updating user");

      const existingUser = await app.db.query.user.findFirst({
        where: eq(userTable.id, request.params.id),
      });

      if (!existingUser) {
        app.logger.warn({ userId: request.params.id }, "User not found");
        return reply.status(404).send({ error: "User not found" });
      }

      const updates: any = {};
      if (request.body.name !== undefined) updates.name = request.body.name;
      if (request.body.role !== undefined) updates.role = request.body.role;
      if (request.body.active !== undefined) updates.active = request.body.active;

      const [updated] = await app.db.update(userTable).set(updates).where(eq(userTable.id, request.params.id)).returning();

      app.logger.info({ userId: updated.id }, "User updated successfully");
      return updated;
    }
  );

  // DELETE /api/users/:id - deactivate user
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/users/:id",
    {
      schema: {
        description: "Deactivate user (set active=false)",
        tags: ["users"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: { type: "object", properties: { message: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ userId: request.params.id }, "Deactivating user");

      const existingUser = await app.db.query.user.findFirst({
        where: eq(userTable.id, request.params.id),
      });

      if (!existingUser) {
        app.logger.warn({ userId: request.params.id }, "User not found");
        return reply.status(404).send({ error: "User not found" });
      }

      await app.db.update(userTable).set({ active: false }).where(eq(userTable.id, request.params.id));

      app.logger.info({ userId: request.params.id }, "User deactivated successfully");
      return { message: "User deactivated" };
    }
  );
}
