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

  // POST /admin/cleanup-non-default-restaurante — cleanup non-default restaurants (one-time operation)
  app.fastify.post(
    "/admin/cleanup-non-default-restaurante",
    {
      schema: {
        description: "Clean up data for non-default restaurants (one-time internal operation)",
        tags: ["admin"],
        response: {
          200: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    table: { type: "string" },
                    rows_deleted: { type: "number" },
                  },
                },
              },
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Starting cleanup of non-default restaurants");

        const DEFAULT_RESTAURANTE_ID = "00000000-0000-0000-0000-000000000001";
        const tables = [
          "prato_insumos",
          "movimentacoes_estoque",
          "pedidos",
          "pagamentos",
          "entregas",
          "notas_fiscais",
          "pedidos_historico",
          "pagamentos_historico",
          "comandas_historico",
        ];

        const results = [];

        for (const table of tables) {
          try {
            const query = `DELETE FROM ${table} WHERE restaurante_id != '${DEFAULT_RESTAURANTE_ID}'`;
            const result = await db.execute(query);
            const rowCount = result.rowCount || 0;

            results.push({
              table,
              rows_deleted: rowCount,
            });

            app.logger.info({ table, rows_deleted: rowCount }, "Cleanup executed");
          } catch (err) {
            app.logger.error({ table, err }, "Error during cleanup for table");
            results.push({
              table,
              rows_deleted: 0,
            });
          }
        }

        app.logger.info({ results }, "Cleanup completed");

        return reply.code(200).send({
          results,
        });
      } catch (err) {
        app.logger.error({ err }, "Cleanup operation failed");
        return reply.code(500).send({ error: "Cleanup failed: " + (err as any).message });
      }
    }
  );

  // POST /admin/cleanup-non-default-restaurante-2 — cleanup non-default restaurants tables (one-time operation)
  app.fastify.post(
    "/admin/cleanup-non-default-restaurante-2",
    {
      schema: {
        description: "Clean up additional tables for non-default restaurants (one-time internal operation)",
        tags: ["admin"],
        response: {
          200: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    table: { type: "string" },
                    rows_deleted: { type: "number" },
                  },
                },
              },
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Starting cleanup of non-default restaurants (phase 2)");

        const DEFAULT_RESTAURANTE_ID = "00000000-0000-0000-0000-000000000001";
        const tables = [
          "insumos",
          "comandas",
          "pratos",
          "categoria_pratos",
          "categorias",
          "mesas",
          "profiles",
          "usuarios",
        ];

        const results = [];

        for (const table of tables) {
          try {
            const query = `DELETE FROM ${table} WHERE restaurante_id != '${DEFAULT_RESTAURANTE_ID}'`;
            const result = await db.execute(query);
            const rowCount = result.rowCount || 0;

            results.push({
              table,
              rows_deleted: rowCount,
            });

            app.logger.info({ table, rows_deleted: rowCount }, "Cleanup executed for phase 2");
          } catch (err) {
            app.logger.error({ table, err }, "Error during cleanup phase 2 for table");
            results.push({
              table,
              rows_deleted: 0,
            });
          }
        }

        app.logger.info({ results }, "Cleanup phase 2 completed");

        return reply.code(200).send({
          results,
        });
      } catch (err) {
        app.logger.error({ err }, "Cleanup phase 2 operation failed");
        return reply.code(500).send({ error: "Cleanup phase 2 failed: " + (err as any).message });
      }
    }
  );

  // POST /admin/cleanup-restaurante-final — final restaurante cleanup (one-time operation)
  app.fastify.post(
    "/admin/cleanup-restaurante-final",
    {
      schema: {
        description: "Final cleanup of non-default restaurants (one-time internal operation)",
        tags: ["admin"],
        response: {
          200: {
            type: "object",
            properties: {
              deleted: {
                type: "object",
                properties: {
                  restaurante: { type: "number" },
                },
              },
              counts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tabela: { type: "string" },
                    total: { type: "number" },
                  },
                },
              },
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
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Starting final restaurante cleanup");

        const DEFAULT_RESTAURANTE_ID = "00000000-0000-0000-0000-000000000001";

        // Step 1: Delete non-default restaurantes
        const deleteResult = await db.execute(
          `DELETE FROM restaurante WHERE id != '${DEFAULT_RESTAURANTE_ID}'`
        );
        const deletedCount = deleteResult.rowCount || 0;

        app.logger.info({ deleted: deletedCount }, "Restaurantes deleted");

        // Step 2: Get verification counts
        const countsResult = await db.execute(
          `SELECT 'restaurante' as tabela, count(*)::int as total FROM restaurante
           UNION ALL SELECT 'mesas', count(*)::int FROM mesas
           UNION ALL SELECT 'categorias', count(*)::int FROM categorias
           UNION ALL SELECT 'pratos', count(*)::int FROM pratos
           UNION ALL SELECT 'comandas', count(*)::int FROM comandas
           UNION ALL SELECT 'pedidos', count(*)::int FROM pedidos
           ORDER BY tabela`
        );

        const counts = (countsResult.rows || []).map((row: any) => ({
          tabela: row.tabela,
          total: row.total,
        }));

        app.logger.info({ counts }, "Final counts retrieved");

        return reply.code(200).send({
          deleted: { restaurante: deletedCount },
          counts,
        });
      } catch (err) {
        app.logger.error({ err }, "Final cleanup operation failed");
        return reply.code(500).send({ error: "Final cleanup failed: " + (err as any).message });
      }
    }
  );
}
