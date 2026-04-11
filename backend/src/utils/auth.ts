import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, gt } from "drizzle-orm";
import { session as sessionTable, user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

export async function requireAuth(
  app: App,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ userId: string; user: any } | null> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Unauthorized" });
    return null;
  }

  const token = authHeader.slice(7);

  try {
    // Look up token in session table
    const sess = await app.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.token, token))
      .limit(1);

    if (!sess || sess.length === 0) {
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    const sessionRecord = sess[0];

    // Check if session has expired
    if (new Date(sessionRecord.expiresAt) <= new Date()) {
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    // Get user from user table
    const users = await app.db
      .select()
      .from(userTable)
      .where(eq(userTable.id, sessionRecord.userId))
      .limit(1);

    if (!users || users.length === 0) {
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }

    const user = users[0];

    return {
      userId: user.id,
      user: user,
    };
  } catch (error) {
    app.logger.error({ err: error }, "Auth validation failed");
    reply.status(401).send({ error: "Unauthorized" });
    return null;
  }
}

export function requireRole(
  user: any,
  allowedRoles: string[],
  reply: FastifyReply
): boolean {
  if (!allowedRoles.includes(user.role)) {
    reply.status(403).send({ error: "Forbidden" });
    return false;
  }
  return true;
}
