import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface CreateUserBody {
  email: string;
  password: string;
  name: string;
  role: string;
}

interface UpdateUserBody {
  name?: string;
  role?: string;
  active?: boolean;
}

export function registerUserRoutes(app: App) {
  // GET /api/users
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
                created_at: { type: "string", format: "date-time" },
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
        app.logger.info({}, "Listing all users");

        const users = await app.db.select().from(userTable);
        const result = users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          created_at: u.createdAt,
        }));

        app.logger.info({ count: result.length }, "Users listed successfully");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list users");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/users
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
          201: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      if (!request.body.email || !request.body.password || !request.body.name || !request.body.role) {
        return reply.status(400).send({ error: "email, password, name, and role are required" });
      }

      try {
        app.logger.info({ email: request.body.email, role: request.body.role }, "Creating new user");

        // Check if user already exists
        const existingUsers = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.email, request.body.email))
          .limit(1);

        if (existingUsers && existingUsers.length > 0) {
          app.logger.info({ email: request.body.email }, "User already exists, updating role");
          const existingUser = existingUsers[0];

          // Update role if different
          if (existingUser.role !== request.body.role) {
            await app.db
              .update(userTable)
              .set({ role: request.body.role as any })
              .where(eq(userTable.id, existingUser.id));
          }

          return reply.status(201).send({
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            role: request.body.role,
            created_at: existingUser.createdAt,
          });
        }

        const result = await app.auth.api.signUpEmail({
          body: {
            email: request.body.email,
            password: request.body.password,
            name: request.body.name,
          },
        });

        app.logger.debug({ result }, "Sign up result");

        if (!result.user) {
          app.logger.warn({ result }, "Sign up did not return user");
          return reply.status(400).send({ error: "Failed to create user" });
        }

        // Update user role
        await app.db
          .update(userTable)
          .set({ role: request.body.role as any })
          .where(eq(userTable.id, result.user.id));

        const createdUsers = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.id, result.user.id))
          .limit(1);

        if (!createdUsers || createdUsers.length === 0) {
          return reply.status(400).send({ error: "Failed to retrieve created user" });
        }

        const createdUser = createdUsers[0];
        app.logger.info({ userId: result.user.id, role: request.body.role }, "User created successfully");

        return reply.status(201).send({
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          created_at: createdUser.createdAt,
        });
      } catch (error) {
        app.logger.error({ err: error, email: request.body.email }, "Failed to create user");
        return reply.status(400).send({ error: "Failed to create user" });
      }
    }
  );

  // GET /api/users/:id
  app.fastify.get<{ Params: { id: string } }>(
    "/api/users/:id",
    {
      schema: {
        description: "Get user by ID",
        tags: ["users"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { type: "object" },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ userId: request.params.id }, "Getting user");

        const users = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.id, request.params.id))
          .limit(1);

        if (!users || users.length === 0) {
          return reply.status(404).send({ error: "User not found" });
        }

        const user = users[0];
        app.logger.info({ userId: user.id }, "User retrieved successfully");

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          created_at: user.createdAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get user");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/users/:id
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
            role: { type: "string", enum: ["garcom", "administrador", "gerente", "cozinheiro"] },
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

        const existing = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
          return reply.status(404).send({ error: "User not found" });
        }

        const updates: any = {};
        if (request.body.name !== undefined) updates.name = request.body.name;
        if (request.body.role !== undefined) updates.role = request.body.role;
        if (request.body.active !== undefined) updates.active = request.body.active;

        const [updated] = await app.db
          .update(userTable)
          .set(updates)
          .where(eq(userTable.id, request.params.id))
          .returning();

        app.logger.info({ userId: updated.id }, "User updated successfully");

        return {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          created_at: updated.createdAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update user");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
