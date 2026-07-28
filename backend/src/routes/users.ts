import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable, account as accountTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { requireAuth as customRequireAuth, requireRole } from "../utils/auth.js";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";

interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role?: string;
}

interface UpdateUserBody {
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
}

export function registerUserRoutes(app: App) {
  // GET /api/users - List all users for the tenant
  app.fastify.get(
    "/api/users",
    {
      schema: {
        description: "List all users in the tenant (requires authentication)",
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
                email_verified: { type: "boolean" },
                image: { type: "string", nullable: true },
                role: { type: "string" },
                active: { type: "boolean" },
                created_at: { type: "string", format: "date-time" },
                updated_at: { type: "string", format: "date-time" },
              },
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
        const tenantId = authUser.restauranteId;
        app.logger.info({ tenantId }, "Listing users");

        const users = await app.db
          .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            emailVerified: userTable.emailVerified,
            image: userTable.image,
            active: userTable.active,
            role: schema.profiles.role,
            createdAt: userTable.createdAt,
            updatedAt: userTable.updatedAt,
          })
          .from(userTable)
          .innerJoin(schema.profiles, eq(userTable.id, schema.profiles.userId))
          .where(eq(schema.profiles.restauranteId, tenantId as any));

        app.logger.info({ tenantId, count: users.length }, "Users listed successfully");

        return users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          email_verified: u.emailVerified,
          image: u.image,
          role: u.role,
          active: u.active,
          created_at: u.createdAt.toISOString(),
          updated_at: u.updatedAt.toISOString(),
        }));
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list users");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/users - Create a new user
  app.fastify.post<{ Body: CreateUserBody }>(
    "/api/users",
    {
      schema: {
        description: "Create a new user (requires admin/gerente role)",
        tags: ["users"],
        body: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            password: { type: "string" },
            role: { type: "string", enum: ["administrador", "gerente", "garcom", "cozinheiro"] },
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
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          409: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateUserBody }>, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        const tenantId = authUser.restauranteId;

        // Check current database role (might have been updated after token was issued)
        const authUserProfile = await app.db
          .select()
          .from(schema.profiles)
          .where(and(
            eq(schema.profiles.userId, authUser.id),
            eq(schema.profiles.restauranteId, tenantId as any)
          ))
          .limit(1);

        const dbRole = authUserProfile.length > 0 ? authUserProfile[0].role?.toLowerCase() : authUser.role?.toLowerCase();
        const isAdmin = ["admin", "administrador", "gerente"].includes(dbRole ?? "");

        if (!isAdmin) {
          app.logger.warn({ tenantId }, "User lacks permission to create user");
          return reply.code(403).send({ error: "Forbidden" });
        }

        const { name, email, password, role = "garcom" } = request.body;

        app.logger.info({ tenantId, email }, "Creating user");

        // Check for duplicate email
        const existing = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.email, email))
          .limit(1);

        if (existing.length > 0) {
          app.logger.warn({ email }, "Email already exists");
          return reply.code(409).send({ error: "Email já cadastrado" });
        }

        const userId = randomUUID();
        const now = new Date();

        // Create user
        await app.db.insert(userTable).values({
          id: userId,
          name,
          email,
          emailVerified: false,
          active: true,
          createdAt: now,
          updatedAt: now,
        });

        // Hash password and create account
        const hashedPassword = await bcrypt.hash(password, 10);
        await app.db.insert(accountTable).values({
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId: userId,
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        });

        // Create profile
        await app.db.insert(schema.profiles).values({
          userId: userId,
          role: role,
          name,
          restauranteId: tenantId as any,
          createdAt: now,
        });

        app.logger.info({ userId, tenantId }, "User created successfully");

        return reply.code(201).send({
          id: userId,
          name,
          email,
          role,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to create user");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/users/:id - Update a user
  app.fastify.put<{ Params: { id: string }; Body: UpdateUserBody }>(
    "/api/users/:id",
    {
      schema: {
        description: "Update a user (requires admin/gerente role to update others, can update self)",
        tags: ["users"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["administrador", "gerente", "garcom", "cozinheiro"] },
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
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserBody }>, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        const tenantId = authUser.restauranteId;
        const { id } = request.params;
        const { name, email, role, active } = request.body;

        app.logger.info({ tenantId, userId: id, isOwn: authUser.id === id }, "Updating user");

        // Verify user belongs to tenant
        const profile = await app.db
          .select()
          .from(schema.profiles)
          .where(and(
            eq(schema.profiles.userId, id),
            eq(schema.profiles.restauranteId, tenantId as any)
          ))
          .limit(1);

        if (profile.length === 0) {
          app.logger.warn({ tenantId, userId: id }, "User not found");
          return reply.code(404).send({ error: "Usuário não encontrado" });
        }

        // Get current user's profile to check actual database role
        const authUserProfile = await app.db
          .select()
          .from(schema.profiles)
          .where(and(
            eq(schema.profiles.userId, authUser.id),
            eq(schema.profiles.restauranteId, tenantId as any)
          ))
          .limit(1);

        // Only allow updating own profile without role check, or require admin for updating others
        const isOwnProfile = authUser.id === id;
        const dbRole = authUserProfile.length > 0 ? authUserProfile[0].role?.toLowerCase() : authUser.role?.toLowerCase();
        const isAdmin = ["admin", "administrador", "gerente"].includes(dbRole ?? "");

        if (!isOwnProfile && !isAdmin) {
          app.logger.warn({ tenantId, userId: id }, "User lacks permission to update other user");
          return reply.code(403).send({ error: "Forbidden" });
        }

        const updateData = {};
        if (name !== undefined) {
          Object.assign(updateData, { name });
        }
        if (email !== undefined) {
          Object.assign(updateData, { email });
        }
        if (active !== undefined && isAdmin) {
          Object.assign(updateData, { active });
        }

        if (Object.keys(updateData).length > 0) {
          await app.db.update(userTable).set(updateData).where(eq(userTable.id, id));
        }

        // Allow updating role if own profile OR if admin
        if (role !== undefined && (isOwnProfile || isAdmin)) {
          await app.db.update(schema.profiles).set({ role }).where(eq(schema.profiles.userId, id));
        }

        app.logger.info({ userId: id }, "User updated successfully");

        const updated = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.id, id))
          .limit(1);

        return reply.code(200).send({
          id: updated[0].id,
          name: updated[0].name,
          email: updated[0].email,
          role: role || profile[0].role,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update user");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/users/:id - Soft delete (deactivate) a user
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/users/:id",
    {
      schema: {
        description: "Soft delete (deactivate) a user (requires admin/gerente role)",
        tags: ["users"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          204: { description: "User deleted successfully" },
          401: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const authUser = await customRequireAuth(app, request, reply);
      if (!authUser) return;

      try {
        const tenantId = authUser.restauranteId;

        // Check current database role (might have been updated after token was issued)
        const authUserProfile = await app.db
          .select()
          .from(schema.profiles)
          .where(and(
            eq(schema.profiles.userId, authUser.id),
            eq(schema.profiles.restauranteId, tenantId as any)
          ))
          .limit(1);

        const dbRole = authUserProfile.length > 0 ? authUserProfile[0].role?.toLowerCase() : authUser.role?.toLowerCase();
        const isAdmin = ["admin", "administrador", "gerente"].includes(dbRole ?? "");

        if (!isAdmin) {
          app.logger.warn({ tenantId }, "User lacks permission to delete user");
          return reply.code(403).send({ error: "Forbidden" });
        }

        const { id } = request.params;

        app.logger.info({ tenantId, userId: id }, "Deactivating user");

        // Verify user belongs to tenant
        const profile = await app.db
          .select()
          .from(schema.profiles)
          .where(and(
            eq(schema.profiles.userId, id),
            eq(schema.profiles.restauranteId, tenantId as any)
          ))
          .limit(1);

        if (profile.length === 0) {
          app.logger.warn({ tenantId, userId: id }, "User not found");
          return reply.code(404).send({ error: "Usuário não encontrado" });
        }

        // Soft delete - set active to false
        await app.db.update(userTable).set({ active: false }).where(eq(userTable.id, id));

        app.logger.info({ userId: id }, "User deactivated successfully");
        return reply.code(204).send();
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete user");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
