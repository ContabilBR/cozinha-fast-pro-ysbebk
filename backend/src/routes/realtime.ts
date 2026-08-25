import type { App } from "../index.js";
import { realtimeHub } from "../realtime/hub.js";
import * as schema from "../db/schema/schema.js";
import { eq, sql } from "drizzle-orm";

export function registerRealtimeRoutes(app: App) {
  const db = app.db as any;

  app.fastify.route({
    method: "GET",
    url: "/api/realtime",
    schema: {
      description: "WebSocket realtime event stream with token authentication",
      tags: ["realtime"],
    },
    wsHandler: (socket: any, request: any) => {
      app.logger.info({}, "WebSocket connection established");

      let connectionId: string | null = null;
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
          if (isAuthenticated) {
            // Ignore further messages after authentication
            return;
          }

          let token: string;
          try {
            const message = JSON.parse(rawMessage.toString());
            token = message.token;
          } catch {
            // Fall back to treating message as plain token string
            token = rawMessage.toString();
          }

          if (!token || token.length === 0) {
            app.logger.warn({}, "Empty token received");
            socket.send(JSON.stringify({ error: "Token required" }));
            socket.close();
            clearTimeout(timeoutId);
            return;
          }

          // Query usuarios_session (the table POST /api/login actually
          // writes to) joined with usuarios to get restaurante_id.
          let restauranteId: string;
          try {
            const sessions = await db
              .select({
                userId: schema.usuariosSession.userId,
                expiresAt: schema.usuariosSession.expiresAt,
                restauranteId: schema.usuarios.restauranteId,
              })
              .from(schema.usuariosSession)
              .innerJoin(
                schema.usuarios,
                sql`${schema.usuarios.id}::text = ${schema.usuariosSession.userId}`
              )
              .where(eq(schema.usuariosSession.token, token))
              .limit(1);

            if (!sessions || sessions.length === 0) {
              app.logger.warn({ token: token.substring(0, 10) }, "Invalid token");
              socket.send(JSON.stringify({ error: "Invalid token" }));
              socket.close();
              clearTimeout(timeoutId);
              return;
            }

            if (new Date(sessions[0].expiresAt) < new Date()) {
              app.logger.warn({ token: token.substring(0, 10) }, "Expired token");
              socket.send(JSON.stringify({ error: "Invalid token" }));
              socket.close();
              clearTimeout(timeoutId);
              return;
            }

            restauranteId = sessions[0].restauranteId;
          } catch (queryErr: any) {
            app.logger.error({ err: queryErr }, "Error querying token");
            socket.send(JSON.stringify({ error: "Authentication error" }));
            socket.close();
            clearTimeout(timeoutId);
            return;
          }

          isAuthenticated = true;
          clearTimeout(timeoutId);

          // Register connection with hub
          connectionId = realtimeHub.registerConnection(socket, restauranteId);
          app.logger.info({ restauranteId, connectionId }, "WebSocket authenticated");

          // Send connected message
          socket.send(JSON.stringify({ type: "connected", restauranteId }));
        } catch (err) {
          app.logger.error({ err }, "Error processing WebSocket message");
          socket.send(JSON.stringify({ error: "Internal error" }));
          socket.close();
        }
      });

      socket.on("close", () => {
        if (connectionId) {
          realtimeHub.deregisterConnection(connectionId);
          app.logger.info({ connectionId }, "WebSocket connection closed");
        }
      });

      socket.on("error", (err: any) => {
        app.logger.error({ err }, "WebSocket error");
        if (connectionId) {
          realtimeHub.deregisterConnection(connectionId);
        }
      });
    },
    handler: async (request: any, reply: any) => {
      return { protocol: "ws", path: "/api/realtime" };
    },
  });
}
