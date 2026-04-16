import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { user as userTable, session as sessionTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { randomUUID } from "crypto";

interface LoginBody {
  email: string;
  password: string;
}

interface SignUpBody {
  name: string;
  email: string;
  password: string;
}

// Simple token generation (base64 encoded userId:timestamp)
function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  return Buffer.from(payload).toString("base64");
}

export function registerAuthRoutes(app: App) {
  // POST /api/auth/sign-up/email
  app.fastify.post<{ Body: SignUpBody }>(
    "/api/auth/sign-up/email",
    {
      schema: {
        description: "Sign up new user with email",
        tags: ["auth"],
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
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  emailVerified: { type: "boolean" },
                  image: { type: ["string", "null"] },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SignUpBody }>, reply: FastifyReply) => {
      try {
        app.logger.info({ email: request.body.email }, "Sign up attempt");

        const { name, email, password } = request.body;

        if (!name || !email || !password) {
          reply.status(400);
          return { error: "Name, email and password are required" };
        }

        // Use Better Auth sign up API
        try {
          const result = await app.auth.api.signUpEmail({
            body: { name, email, password },
          });

          if (!result.user) {
            app.logger.info({ email }, "Sign up failed: user creation failed");
            reply.status(400);
            return { error: "Failed to create user" };
          }

          const authUser = result.user;

          // Generate simple token
          const token = generateToken(authUser.id);

          // Store token in session table
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          await app.db.insert(sessionTable).values({
            id: randomUUID(),
            userId: authUser.id,
            token,
            expiresAt,
          });

          app.logger.info({ userId: authUser.id, email }, "Sign up successful");

          reply.status(200);
          return {
            token,
            user: {
              id: authUser.id,
              name: authUser.name,
              email: authUser.email,
              emailVerified: authUser.emailVerified,
              image: authUser.image,
              createdAt: authUser.createdAt,
              updatedAt: authUser.updatedAt,
            },
          };
        } catch (authError) {
          app.logger.info({ email }, "Sign up failed: authentication error");
          reply.status(400);
          return { error: "Email already exists" };
        }
      } catch (error) {
        app.logger.error({ err: error }, "Sign up failed with error");
        reply.status(400);
        return { error: "Failed to create user" };
      }
    }
  );

  // POST /api/auth/login
  app.fastify.post<{ Body: LoginBody }>(
    "/api/auth/login",
    {
      schema: {
        description: "User login with email and password",
        tags: ["auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      try {
        app.logger.info({ email: request.body.email }, "Login attempt");

        const { email, password } = request.body;

        if (!email || !password) {
          reply.status(400);
          return { error: "Email and password are required" };
        }

        // Use Better Auth sign in API
        try {
          const result = await app.auth.api.signInEmail({
            body: { email, password },
          });

          if (!result.user) {
            app.logger.info({ email }, "Login failed: invalid credentials");
            reply.status(400);
            return { error: "Credenciais inválidas" };
          }

          const authUser = result.user;

          // Fetch role from database
          const users = await app.db
            .select({ role: userTable.role })
            .from(userTable)
            .where(eq(userTable.id, authUser.id))
            .limit(1);

          const role = users?.[0]?.role || "garcom";

          // Generate simple token
          const token = generateToken(authUser.id);

          // Store token in session table
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          await app.db.insert(sessionTable).values({
            id: randomUUID(),
            userId: authUser.id,
            token,
            expiresAt,
          });

          app.logger.info({ userId: authUser.id, email }, "Login successful");

          reply.status(200);
          return {
            token,
            user: {
              id: authUser.id,
              name: authUser.name,
              email: authUser.email,
              role,
            },
          };
        } catch (authError) {
          app.logger.info({ email }, "Login failed: authentication error");
          reply.status(400);
          return { error: "Credenciais inválidas" };
        }
      } catch (error) {
        app.logger.error({ err: error }, "Login failed with error");
        reply.status(400);
        return { error: "Credenciais inválidas" };
      }
    }
  );

  // GET /api/auth/me
  app.fastify.get(
    "/api/auth/me",
    {
      schema: {
        description: "Get current authenticated user",
        tags: ["auth"],
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Getting current user");

        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            user: null,
          };
        }

        const token = authHeader.slice(7).trim();

        // Decode token (simple base64 decode)
        try {
          const payload = Buffer.from(token, "base64").toString("utf-8");
          const userId = payload.split(":")[0];

          const users = await app.db
            .select()
            .from(userTable)
            .where(eq(userTable.id, userId))
            .limit(1);

          if (!users || users.length === 0) {
            return {
              user: null,
            };
          }

          const user = users[0];
          app.logger.info({ userId }, "Current user retrieved");

          return {
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            },
          };
        } catch {
          return {
            user: null,
          };
        }
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get current user");
        return {
          user: null,
        };
      }
    }
  );

  // POST /api/auth/delete-user - Delete authenticated user
  app.fastify.post(
    "/api/auth/delete-user",
    {
      schema: {
        description: "Delete the authenticated user account",
        tags: ["auth"],
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Deleting user account");

        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          reply.status(401);
          return { error: "Unauthorized" };
        }

        const token = authHeader.slice(7).trim();

        // Look up token in session table
        const sess = await app.db
          .select()
          .from(sessionTable)
          .where(eq(sessionTable.token, token))
          .limit(1);

        if (!sess || sess.length === 0) {
          reply.status(401);
          return { error: "Unauthorized" };
        }

        const sessionRecord = sess[0];
        const userId = sessionRecord.userId;

        // Delete the user
        await app.db
          .update(userTable)
          .set({ active: false })
          .where(eq(userTable.id, userId));

        // Delete all sessions for this user
        await app.db
          .delete(sessionTable)
          .where(eq(sessionTable.userId, userId));

        app.logger.info({ userId }, "User account deleted");

        reply.status(200);
        return { success: true };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete user account");
        reply.status(500);
        return { error: "Failed to delete user account" };
      }
    }
  );
}
