import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and, inArray, sql, gte, lt } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

interface DashboardData {
  tablesStatus: {
    livre: number;
    ocupada: number;
    reservada: number;
    fechando: number;
  };
  openOrdersCount: number;
  kitchenQueueCount: number;
  todayRevenue: string;
}

export function registerDashboardRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/dashboard
  app.fastify.get(
    "/api/dashboard",
    {
      schema: {
        description: "Get dashboard summary",
        tags: ["dashboard"],
        response: {
          200: {
            type: "object",
            properties: {
              tablesStatus: {
                type: "object",
                properties: {
                  livre: { type: "number" },
                  ocupada: { type: "number" },
                  reservada: { type: "number" },
                  fechando: { type: "number" },
                },
              },
              openOrdersCount: { type: "number" },
              kitchenQueueCount: { type: "number" },
              todayRevenue: { type: "string" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, "Fetching dashboard data");

      // Tables status count
      const allTables = await app.db.select().from(schema.tables);
      const tablesStatus = {
        livre: 0,
        ocupada: 0,
        reservada: 0,
        fechando: 0,
      };

      for (const table of allTables) {
        if (table.status === "livre") tablesStatus.livre++;
        else if (table.status === "ocupada") tablesStatus.ocupada++;
        else if (table.status === "reservada") tablesStatus.reservada++;
        else if (table.status === "fechando") tablesStatus.fechando++;
      }

      // Open orders count
      const openOrders = await app.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.status, "aberta"));

      const openOrdersCount = openOrders.length;

      // Kitchen queue count (items with status IN ('pendente', 'recebido', 'em_preparo'))
      const kitchenQueue = await app.db
        .select()
        .from(schema.orderItems)
        .where(inArray(schema.orderItems.status, ["pendente", "recebido", "em_preparo"]));

      const kitchenQueueCount = kitchenQueue.length;

      // Today's revenue (sum of closed orders today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const todayClosedOrders = await app.db
        .select()
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.status, "fechada"),
            gte(schema.orders.closedAt, today),
            lt(schema.orders.closedAt, tomorrow)
          )
        );

      // Filter to only include orders with closedAt set
      const todayClosedOrdersFiltered = todayClosedOrders.filter(o => o.closedAt !== null);

      const todayRevenue = todayClosedOrdersFiltered.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);

      app.logger.info({ openOrdersCount, kitchenQueueCount, todayRevenue }, "Dashboard data fetched");

      return {
        tablesStatus,
        openOrdersCount,
        kitchenQueueCount,
        todayRevenue: todayRevenue.toFixed(2),
      };
    }
  );
}
