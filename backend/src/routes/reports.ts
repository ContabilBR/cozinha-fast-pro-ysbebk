import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, sql } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

interface ReportQuery {
  date_from?: string;
  date_to?: string;
}

export function registerReportRoutes(app: App) {
  // GET /api/reports/summary - Get summary report
  app.fastify.get<{ Querystring: ReportQuery }>(
    "/api/reports/summary",
    {
      schema: {
        description: "Get sales summary report",
        tags: ["reports"],
        querystring: {
          type: "object",
          properties: {
            date_from: { type: "string", format: "date-time" },
            date_to: { type: "string", format: "date-time" },
          },
        },
        response: {
          200: { type: "object" },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      try {
        app.logger.info({ query: request.query }, "Generating summary report");

        // Get all orders
        const allOrders = await app.db.select().from(schema.orders);

        // Filter by dates if provided
        let filteredOrders = allOrders;
        if (request.query.date_from || request.query.date_to) {
          filteredOrders = allOrders.filter((o) => {
            if (request.query.date_from && o.openedAt < new Date(request.query.date_from)) return false;
            if (request.query.date_to && o.openedAt > new Date(request.query.date_to)) return false;
            return true;
          });
        }

        // Calculate metrics
        const closedOrders = filteredOrders.filter((o) => o.status === "fechada" || o.status === "aberta");
        const cancelledOrders = filteredOrders.filter((o) => o.status === "cancelada");
        const openOrders = filteredOrders.filter((o) => o.status === "aberta");

        const totalRevenue = closedOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || "0"), 0);
        const avgTicket = closedOrders.length > 0 ? totalRevenue / closedOrders.length : 0;

        // Get all items for top dishes
        const allItems = await app.db.select().from(schema.orderItems);
        const dishesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

        for (const item of allItems) {
          if (!dishesMap[item.dishId]) {
            // Fetch dish name
            const dishes = await app.db
              .select()
              .from(schema.dishes)
              .where(eq(schema.dishes.id, item.dishId));

            dishesMap[item.dishId] = {
              name: dishes[0]?.name || "Unknown",
              quantity: 0,
              revenue: 0,
            };
          }

          dishesMap[item.dishId].quantity += item.quantity;
          dishesMap[item.dishId].revenue += parseFloat(item.unitPrice || "0") * item.quantity;
        }

        const topDishes = Object.entries(dishesMap)
          .map(([id, data]) => ({
            dish_id: id,
            dish_name: data.name,
            quantity: data.quantity,
            revenue: data.revenue.toFixed(2),
          }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        // Count by status
        const ordersByStatus: Record<string, number> = {
          aberta: openOrders.length,
          fechada: filteredOrders.filter((o) => o.status === "fechada").length,
          cancelada: cancelledOrders.length,
        };

        app.logger.info({ totalRevenue, totalOrders: filteredOrders.length }, "Summary report generated");

        return {
          total_revenue: totalRevenue.toFixed(2),
          total_orders: filteredOrders.length,
          open_orders: openOrders.length,
          avg_ticket: avgTicket.toFixed(2),
          cancelled_count: cancelledOrders.length,
          top_dishes: topDishes,
          orders_by_status: ordersByStatus,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to generate summary report");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
