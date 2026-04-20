import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { session as sessionTable, user as userTable } from "../db/schema/auth-schema.js";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

export interface AuthContext {
  id: string;
  email: string;
  role: string;
  name: string;
}

export async function requireAuth(
  app: App,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthContext | null> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      app.logger.warn({ authHeader: authHeader?.substring(0, 20) }, "Missing or invalid authorization header");
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    const token = authHeader.slice(7).trim();
    app.logger.debug({ token: token.substring(0, 20) }, "Validating bearer token");

    // Try custom usuarios_session table first
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

      // Try to find user in usuarios table (session.userId is text, usuarios.id is UUID)
      const usuarios = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, session.userId as any))
        .limit(1);

      if (usuarios && usuarios.length > 0) {
        const usuario = usuarios[0];
        app.logger.info({ userId: usuario.id, email: usuario.email }, "Usuarios session auth validation successful");

        return {
          id: usuario.id.toString(),
          email: usuario.email,
          role: usuario.role,
          name: usuario.nome,
        };
      }

      // Fall back to user table (Better Auth) if not found in usuarios
      const users = await app.db
        .select()
        .from(userTable)
        .where(eq(userTable.id, session.userId))
        .limit(1);

      if (users && users.length > 0) {
        const user = users[0];
        app.logger.info({ userId: user.id }, "Usuarios session auth validation successful (Better Auth user)");

        return {
          id: user.id,
          email: user.email,
          role: user.role ?? "garcom",
          name: user.name || "",
        };
      }

      app.logger.warn({ userId: session.userId }, "User not found in either usuarios or user table");
      reply.status(401).send({ error: "User not found" });
      return null;
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
      reply.status(401).send({ error: "User not found" });
      return null;
    }

    const user = users[0];
    app.logger.info({ userId: user.id }, "Better Auth session validation successful");

    return {
      id: user.id,
      email: user.email,
      role: user.role ?? "garcom",
      name: user.name || "",
    };
  } catch (error) {
    app.logger.error({ err: error }, "Auth validation failed");
    reply.status(401).send({ error: "Unauthorized" });
    return null;
  }
}

export function requireRole(
  authUserOrUser: AuthContext | any,
  allowedRolesOrProfile?: string[] | any,
  allowedRolesOrReply?: string[] | FastifyReply,
  reply?: FastifyReply
): boolean {
  // Handle both old (3 args) and new (2 args) signatures for backward compatibility
  let userRole: string;
  let actualReply: FastifyReply;

  if (Array.isArray(allowedRolesOrProfile)) {
    // New signature: (authContext, allowedRoles, reply)
    userRole = authUserOrUser.role;
    actualReply = allowedRolesOrReply as FastifyReply;
    const allowedRoles = allowedRolesOrProfile as string[];
    if (!allowedRoles.includes(userRole)) {
      actualReply.status(403).send({ error: "Forbidden" });
      return false;
    }
  } else {
    // Old signature: (user, profile, allowedRoles, reply)
    userRole = allowedRolesOrProfile?.role || authUserOrUser?.role;
    actualReply = reply!;
    const allowedRoles = allowedRolesOrReply as string[];
    if (!allowedRoles.includes(userRole)) {
      actualReply.status(403).send({ error: "Forbidden" });
      return false;
    }
  }
  return true;
}
