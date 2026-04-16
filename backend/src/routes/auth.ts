import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

interface LoginBody {
  email: string;
  password: string;
}

// Simple token generation (base64 encoded userId:timestamp)
function generateToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  return Buffer.from(payload).toString("base64");
}

export function registerAuthRoutes(app: App) {
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
          return reply.status(400).send({ error: "Email and password are required" });
        }

        // Use Better Auth sign in API
        try {
          const result = await app.auth.api.signInEmail({
            body: { email, password },
          });

          if (!result.user) {
            app.logger.info({ email }, "Login failed: invalid credentials");
            return reply.status(400).send({ error: "Credenciais inválidas" });
          }

          // Fetch user with role from database
          const users = await app.db
            .select()
            .from(userTable)
            .where(eq(userTable.id, result.user.id))
            .limit(1);

          if (!users || users.length === 0) {
            app.logger.info({ userId: result.user.id }, "Login failed: user not found in database");
            return reply.status(400).send({ error: "Credenciais inválidas" });
          }

          const dbUser = users[0];

          // Generate simple token
          const token = generateToken(dbUser.id);

          app.logger.info({ userId: dbUser.id, email }, "Login successful");

          return {
            token,
            user: {
              id: dbUser.id,
              name: dbUser.name,
              email: dbUser.email,
              role: dbUser.role,
            },
          };
        } catch (authError) {
          app.logger.info({ email }, "Login failed: authentication error");
          return reply.status(400).send({ error: "Credenciais inválidas" });
        }
      } catch (error) {
        app.logger.error({ err: error }, "Login failed with error");
        return reply.status(400).send({ error: "Credenciais inválidas" });
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

        const token = authHeader.substring(7);

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
}
