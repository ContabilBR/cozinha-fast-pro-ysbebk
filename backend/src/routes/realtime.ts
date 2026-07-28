import { eq, and } from "drizzle-orm";
import type { App } from "../index.js";
import * as schema from "../db/schema/schema.js";
import { realtimeHub } from "../utils/realtime.js";

export function registerRealtimeRoutes(app: App) {
  const db = app.db as any;

  app.fastify.route({
    method: "GET",
    url: "/api/realtime",
    schema: {
      description: "WebSocket realtime event stream. Send token as first message to authenticate.",
      tags: ["realtime"],
    },
    wsHandler: (socket: any, request: any) => {
    app.logger.info({}, "WebSocket connection received");

    let restauranteId: string | null = null;
    let isAuthenticated = false;
    const timeoutId = setTimeout(() => {
      if (!isAuthenticated) {
        app.logger.warn({}, "WebSocket auth timeout");
        socket.send(JSON.stringify({ error: "Authentication timeout" }));
        socket.close();
      }
    }, 5000);

    socket.on("message", async (rawMessage: any) => {
      try {
        // Parse first message (token)
        let message;
        try {
          message = JSON.parse(rawMessage.toString());
        } catch {
          app.logger.warn({}, "Invalid JSON received");
          socket.send(JSON.stringify({ error: "Invalid JSON" }));
          socket.close();
          return;
        }

        if (!message.token) {
          app.logger.warn({}, "No token in first message");
          socket.send(JSON.stringify({ error: "Token required" }));
          socket.close();
          return;
        }

        const token = message.token;
        let foundRid: string | null = null;

        // Try to validate token via usuarios_session first
        const usuariosSession = await db
          .select({
            userId: schema.usuariosSession.userId,
            expiresAt: schema.usuariosSession.expiresAt,
          })
          .from(schema.usuariosSession)
          .where(eq(schema.usuariosSession.token, token))
          .limit(1);

        if (usuariosSession.length > 0) {
          const session = usuariosSession[0];
          const now = new Date();
          if (new Date(session.expiresAt) > now) {
            // Token is valid, get restauranteId from usuarios
            const usuario = await db
              .select({ restauranteId: schema.usuarios.restauranteId })
              .from(schema.usuarios)
              .where(eq(schema.usuarios.id, session.userId))
              .limit(1);

            if (usuario.length > 0) {
              foundRid = usuario[0].restauranteId;
            }
          }
        }

        // If not found in usuarios_session, try Better Auth
        if (!foundRid) {
          try {
            const betterAuthSession = await app.authenticateWsToken(token);
            if (betterAuthSession && betterAuthSession.user && betterAuthSession.user.id) {
              // Get restauranteId from profiles
              const profiles = await db
                .select({ restauranteId: schema.profiles.restauranteId })
                .from(schema.profiles)
                .where(eq(schema.profiles.userId, betterAuthSession.user.id))
                .limit(1);

              if (profiles.length > 0) {
                foundRid = profiles[0].restauranteId;
              }
            }
          } catch (err) {
            app.logger.debug({ err }, "Better Auth token validation failed");
          }
        }

        if (!foundRid) {
          app.logger.warn({ token: token.substring(0, 10) }, "Token validation failed");
          socket.send(JSON.stringify({ error: "Invalid token" }));
          socket.close();
          clearTimeout(timeoutId);
          return;
        }

        restauranteId = foundRid;
        isAuthenticated = true;
        clearTimeout(timeoutId);

        // Add connection to hub
        realtimeHub.addConnection(restauranteId, socket);
        app.logger.info({ restauranteId }, "WebSocket authenticated and connected");

        // Send connected message
        socket.send(JSON.stringify({ type: "connected" }));
      } catch (err) {
        app.logger.error({ err }, "Error processing WebSocket message");
        socket.send(JSON.stringify({ error: "Internal error" }));
        socket.close();
      }
    });

    socket.on("close", () => {
      if (restauranteId) {
        realtimeHub.removeConnection(restauranteId, socket);
        app.logger.info({ restauranteId }, "WebSocket connection closed and cleaned up");
      }
    });

    socket.on("error", (err: any) => {
      app.logger.error({ err }, "WebSocket error");
      if (restauranteId) {
        realtimeHub.removeConnection(restauranteId, socket);
      }
    });
    },
    handler: async (request: any, reply: any) => {
      return { protocol: "ws", path: "/api/realtime" };
    },
  });
}
