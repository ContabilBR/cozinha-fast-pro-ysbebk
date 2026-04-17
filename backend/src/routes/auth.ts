import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { user as userTable, session as sessionTable } from "../db/schema/auth-schema.js";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { randomUUID } from "crypto";

interface SignInBody {
  email: string;
  password: string;
}

interface SignUpBody {
  name: string;
  email: string;
  password: string;
}

// Generate a simple token (base64 encoded random ID)
function generateToken(): string {
  return Buffer.from(randomUUID()).toString("base64").substring(0, 32);
}

export function registerAuthRoutes(app: App) {
  // POST /api/auth/sign-in
  app.fastify.post<{ Body: SignInBody }>(
    "/api/auth/sign-in",
    {
      schema: {
        description: "Sign in user with email and password",
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
              profile: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  name: { type: "string" },
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
    async (request: FastifyRequest<{ Body: SignInBody }>, reply: FastifyReply) => {
      try {
        app.logger.info({ email: request.body.email }, "Sign in attempt");

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
            app.logger.info({ email }, "Sign in failed: invalid credentials");
            reply.status(400);
            return { error: "Invalid email or password" };
          }

          const authUser = result.user;

          // Fetch user with profile from database
          const users = await app.db
            .select({
              id: userTable.id,
              name: userTable.name,
              email: userTable.email,
              role: userTable.role,
            })
            .from(userTable)
            .where(eq(userTable.id, authUser.id))
            .limit(1);

          if (!users || users.length === 0) {
            reply.status(400);
            return { error: "User not found" };
          }

          const user = users[0];

          // Fetch profile
          const profiles = await app.db
            .select({
              role: schema.profiles.role,
              name: schema.profiles.name,
            })
            .from(schema.profiles)
            .where(eq(schema.profiles.userId, authUser.id))
            .limit(1);

          const profile = profiles && profiles.length > 0 ? profiles[0] : { role: user.role, name: user.name };

          // Generate token
          const token = generateToken();

          // Store token in session table
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          await app.db.insert(sessionTable).values({
            id: randomUUID(),
            userId: authUser.id,
            token,
            expiresAt,
          });

          app.logger.info({ userId: authUser.id, email }, "Sign in successful");

          reply.status(200);
          return {
            token,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
            },
            profile,
          };
        } catch (authError) {
          app.logger.info({ email }, "Sign in failed: authentication error");
          reply.status(400);
          return { error: "Invalid email or password" };
        }
      } catch (error) {
        app.logger.error({ err: error }, "Sign in failed with error");
        reply.status(500);
        return { error: "Internal server error" };
      }
    }
  );

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
          201: {
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
              profile: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  name: { type: "string" },
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

          // Create profile for new user
          try {
            await app.db.insert(schema.profiles).values({
              userId: authUser.id,
              role: "garcom",
              name: authUser.name,
            });
          } catch (profileErr) {
            app.logger.warn({ userId: authUser.id }, "Failed to create profile");
          }

          // Generate token
          const token = generateToken();

          // Store token in session table
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          await app.db.insert(sessionTable).values({
            id: randomUUID(),
            userId: authUser.id,
            token,
            expiresAt,
          });

          app.logger.info({ userId: authUser.id, email }, "Sign up successful");

          reply.status(201);
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
          app.logger.info({ email }, "Sign up failed: email already exists");
          reply.status(400);
          return { error: "Email already exists" };
        }
      } catch (error) {
        app.logger.error({ err: error }, "Sign up failed with error");
        reply.status(500);
        return { error: "Internal server error" };
      }
    }
  );

  // POST /api/auth/sign-out
  app.fastify.post(
    "/api/auth/sign-out",
    {
      schema: {
        description: "Sign out user",
        tags: ["auth"],
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Sign out attempt");

        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          reply.status(401);
          return { error: "Unauthorized" };
        }

        const token = authHeader.slice(7).trim();

        // Delete session token
        await app.db
          .delete(sessionTable)
          .where(eq(sessionTable.token, token));

        app.logger.info({}, "Sign out successful");

        reply.status(200);
        return { success: true };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to sign out");
        reply.status(500);
        return { error: "Internal server error" };
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
              profile: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  name: { type: "string" },
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
            profile: null,
          };
        }

        const token = authHeader.slice(7).trim();

        // Look up token in session table
        const sess = await app.db
          .select()
          .from(sessionTable)
          .where(eq(sessionTable.token, token))
          .limit(1);

        if (!sess || sess.length === 0) {
          return {
            user: null,
            profile: null,
          };
        }

        const sessionRecord = sess[0];

        // Check if session has expired
        if (new Date(sessionRecord.expiresAt) <= new Date()) {
          return {
            user: null,
            profile: null,
          };
        }

        // Get user
        const users = await app.db
          .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            role: userTable.role,
          })
          .from(userTable)
          .where(eq(userTable.id, sessionRecord.userId))
          .limit(1);

        if (!users || users.length === 0) {
          return {
            user: null,
            profile: null,
          };
        }

        const user = users[0];

        // Get profile
        const profiles = await app.db
          .select({
            role: schema.profiles.role,
            name: schema.profiles.name,
          })
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, user.id))
          .limit(1);

        const profile = profiles && profiles.length > 0 ? profiles[0] : { role: user.role, name: user.name };

        app.logger.info({ userId: user.id }, "Current user retrieved");

        return {
          user,
          profile,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get current user");
        return {
          user: null,
          profile: null,
        };
      }
    }
  );
}
