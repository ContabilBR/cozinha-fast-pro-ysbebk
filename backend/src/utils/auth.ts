import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { session as sessionTable, user as userTable } from "../db/schema/auth-schema.js";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

export async function requireAuth(
  app: App,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ userId: string; user: any; profile: any } | null> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      app.logger.warn({ authHeader: authHeader?.substring(0, 20) }, "Missing or invalid authorization header");
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    const token = authHeader.slice(7).trim();
    app.logger.debug({ token: token.substring(0, 20) }, "Validating bearer token");

    // Try custom usuarios_session table first (new custom auth)
    const usuariosSessions = await app.db
      .select()
      .from(schema.usuariosSession)
      .where(eq(schema.usuariosSession.token, token))
      .limit(1);

    if (usuariosSessions && usuariosSessions.length > 0) {
      const session = usuariosSessions[0];

      // Check if session has expired
      if (new Date(session.expiresAt) < new Date()) {
        app.logger.warn({ sessionId: session.id }, "Usuarios session expired");
        reply.status(401).send({ error: "Unauthorized" });
        return null;
      }

      // Get user from usuarios table
      const usuarios = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, session.userId as any))
        .limit(1);

      if (!usuarios || usuarios.length === 0) {
        app.logger.warn({ userId: session.userId }, "Usuario not found for session");
        reply.status(401).send({ error: "Unauthorized" });
        return null;
      }

      const usuario = usuarios[0];
      app.logger.info({ userId: usuario.id, email: usuario.email }, "Usuarios session auth validation successful");

      return {
        userId: usuario.id,
        user: usuario,
        profile: { role: usuario.role, name: usuario.nome },
      };
    }

    // Fall back to Better Auth session table
    app.logger.debug({ token: token.substring(0, 20) }, "Token not found in usuarios_session, trying Better Auth session");

    const sessions = await app.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, token))
      .limit(1);

    if (!sessions || sessions.length === 0) {
      app.logger.warn({ token: token.substring(0, 20) }, "Session not found in either table");
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    const session = sessions[0];

    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      app.logger.warn({ sessionId: session.id }, "Better Auth session expired");
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
      app.logger.warn({ userId: session.userId }, "User not found for Better Auth session");
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

    app.logger.info({ userId: user.id }, "Better Auth session validation successful");

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
