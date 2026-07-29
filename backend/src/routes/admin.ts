import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";

export function registerAdminRoutes(app: App) {
  const db = app.db as any;

  // Run automatic cleanup on startup
  (async () => {
    try {
      const result = await db.execute(
        `DELETE FROM pagamentos WHERE comanda_id = 'c36e61c1-f332-460c-9c73-722bcc6f5869' AND status = 'pendente'`
      );
      console.log(`Deleted ${result.rowCount} pagamentos pendentes for comanda c36e61c1-f332-460c-9c73-722bcc6f5869`);
    } catch (err) {
      app.logger.warn({ err }, "Startup migration cleanup failed");
    }
  })();

  // POST /admin/run-migration — execute raw SQL (temporary admin endpoint)
  app.fastify.post<{ Body: { query: string } }>(
    "/admin/run-migration",
    {
      schema: {
        description: "Execute raw SQL query (temporary admin endpoint)",
        tags: ["admin"],
        body: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
          required: ["query"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              deleted: { type: "number" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { query: string } }>, reply: FastifyReply) => {
      try {
        const { query } = request.body;

        if (!query || typeof query !== "string") {
          return reply.code(400).send({ error: "Query is required and must be a string" });
        }

        app.logger.info({ query }, "Executing admin migration query");

        const result = await db.execute(query);

        app.logger.info({ rowCount: result.rowCount }, "Admin migration query executed");

        return reply.code(200).send({
          deleted: result.rowCount || 0,
        });
      } catch (err) {
        app.logger.error({ err }, "Admin migration query failed");
        return reply.code(500).send({ error: "Query execution failed: " + (err as any).message });
      }
    }
  );
}
