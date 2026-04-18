import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { session as sessionTable, user as userTable } from "../db/schema/auth-schema.js";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import jwt from "jsonwebtoken";

// JWT constants (must match auth-custom.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'cozinhafast_secret_2024';

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  nome: string;
}

export async function requireAuth(
  app: App,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ userId: string; user: any; profile: any } | null> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      app.logger.warn({}, "Missing or invalid authorization header");
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    const token = authHeader.slice(7).trim();

    // Try to validate as JWT token first (custom JWT auth)
    try {
      const jwtPayload = jwt.verify(token, JWT_SECRET) as JWTPayload;

      // Get user from usuarios table (custom auth)
      const usuarios = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, jwtPayload.id))
        .limit(1);

      if (!usuarios || usuarios.length === 0) {
        app.logger.warn({ userId: jwtPayload.id }, "Usuario not found for JWT token");
        reply.status(401).send({ error: "Unauthorized" });
        return null;
      }

      const usuario = usuarios[0];

      app.logger.info({ userId: usuario.id, email: usuario.email }, "JWT token auth validation successful");

      return {
        userId: usuario.id,
        user: usuario,
        profile: { role: usuario.role, name: usuario.nome },
      };
    } catch (jwtErr) {
      // JWT validation failed, try Better Auth session
      app.logger.debug({ error: (jwtErr as Error).message }, "Not a valid JWT token, trying session lookup");
    }

    // Try to look up token in Better Auth session table
    const sessions = await app.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, token))
      .limit(1);

    if (!sessions || sessions.length === 0) {
      app.logger.warn({ token: token.substring(0, 10) + "..." }, "Session not found for token and JWT validation failed");
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    const session = sessions[0];

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      app.logger.warn({ sessionId: session.id }, "Session expired");
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    // Get user from user table (Better Auth)
    const users = await app.db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.userId))
      .limit(1);

    if (!users || users.length === 0) {
      app.logger.warn({ userId: session.userId }, "User not found for session");
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    const user = users[0];

    // Get profile for role information
    const profiles = await app.db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1);

    const profile = profiles && profiles.length > 0
      ? { role: profiles[0].role, name: profiles[0].name }
      : { role: user.role || "usuario", name: user.name };

    app.logger.info({ userId: user.id }, "Session auth validation successful");

    return {
      userId: user.id,
      user: user,
      profile: profile,
    };
  } catch (error) {
    app.logger.error({ err: error }, "Auth validation failed");
    reply.status(401).send({ error: "Unauthorized" });
    return null;
  }
}

export function requireRole(
  user: any,
  profile: any,
  allowedRoles: string[],
  reply: FastifyReply
): boolean {
  // Check both user role and profile role
  const userRole = profile?.role || user?.role;
  if (!allowedRoles.includes(userRole)) {
    reply.status(403).send({ error: "Forbidden" });
    return false;
  }
  return true;
}
