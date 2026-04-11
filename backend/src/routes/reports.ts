import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and, gte, lte } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface ReportQuery {
  date_from?: string;
  date_to?: string;
}

export function registerReportRoutes(app: App) {
  // GET /api/reports/summary
  app.fastify.get<{ Querystring: ReportQuery }>(
    "/api/reports/summary",
    {
      schema: {
        description: "Get revenue summary report",
        tags: ["reports"],
        querystring: {
          type: "object",
          properties: {
            date_from: { type: "string" },
            date_to: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              total_revenue: { type: "string" },
              orders_count: { type: "number" },
              avg_ticket: { type: "string" },
              cancelled_count: { type: "number" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ query: request.query }, "Generating summary report");

        const conditions: any[] = [eq(schema.orders.status, "fechada")];

        if (request.query.date_from) {
          const fromDate = new Date(request.query.date_from);
          conditions.push(gte(schema.orders.closedAt, fromDate));
        }
        if (request.query.date_to) {
          const toDate = new Date(request.query.date_to);
          toDate.setHours(23, 59, 59, 999);
          conditions.push(lte(schema.orders.closedAt, toDate));
        }

        const closedOrders = await app.db
          .select()
          .from(schema.orders)
          .where(and(...conditions));

        // Filter to only include orders with closedAt set
        const closedOrdersFiltered = closedOrders.filter((o) => o.closedAt !== null);

        const totalRevenue = closedOrdersFiltered.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);

        // Get cancelled orders count
        const cancelledConditions: any[] = [eq(schema.orders.status, "cancelada")];
        if (request.query.date_from) {
          const fromDate = new Date(request.query.date_from);
          cancelledConditions.push(gte(schema.orders.createdAt, fromDate));
        }
        if (request.query.date_to) {
          const toDate = new Date(request.query.date_to);
          toDate.setHours(23, 59, 59, 999);
          cancelledConditions.push(lte(schema.orders.createdAt, toDate));
        }

        const cancelledOrders = await app.db
          .select()
          .from(schema.orders)
          .where(and(...cancelledConditions));

        const avgTicket = closedOrdersFiltered.length > 0 ? totalRevenue / closedOrdersFiltered.length : 0;

        app.logger.info({ totalRevenue, ordersCount: closedOrdersFiltered.length }, "Summary report generated");

        return {
          total_revenue: totalRevenue.toFixed(2),
          orders_count: closedOrdersFiltered.length,
          avg_ticket: avgTicket.toFixed(2),
          cancelled_count: cancelledOrders.length,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to generate summary report");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/reports/dishes
  app.fastify.get<{ Querystring: ReportQuery }>(
    "/api/reports/dishes",
    {
      schema: {
        description: "Get top dishes report",
        tags: ["reports"],
        querystring: {
          type: "object",
          properties: {
            date_from: { type: "string" },
            date_to: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dish_id: { type: "string", format: "uuid" },
                dish_name: { type: "string" },
                total_quantity: { type: "number" },
                total_revenue: { type: "string" },
                order_count: { type: "number" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ query: request.query }, "Generating dishes report");

        const baseConditions: any[] = [
          eq(schema.orders.status, "fechada"),
          eq(schema.orderItems.status, "entregue"),
        ];

        if (request.query.date_from) {
          const fromDate = new Date(request.query.date_from);
          baseConditions.push(gte(schema.orders.closedAt, fromDate));
        }
        if (request.query.date_to) {
          const toDate = new Date(request.query.date_to);
          toDate.setHours(23, 59, 59, 999);
          baseConditions.push(lte(schema.orders.closedAt, toDate));
        }

        const items = await app.db
          .select()
          .from(schema.orderItems)
          .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .innerJoin(schema.dishes, eq(schema.orderItems.dishId, schema.dishes.id))
          .where(and(...baseConditions));

        // Filter to only include orders with closedAt set
        const itemsFiltered = items.filter((item) => item.orders.closedAt !== null);

        // Group by dish
        const dishMap: Record<string, any> = {};

        for (const item of itemsFiltered) {
          const dishId = item.order_items.dishId;
          const dishName = item.dishes.name;

          if (!dishMap[dishId]) {
            dishMap[dishId] = {
              dishId,
              dishName,
              totalQuantity: 0,
              totalRevenue: 0,
              orderCount: new Set(),
            };
          }

          dishMap[dishId].totalQuantity += item.order_items.quantity;
          dishMap[dishId].totalRevenue += parseFloat(item.order_items.unitPrice) * item.order_items.quantity;
          dishMap[dishId].orderCount.add(item.order_items.orderId);
        }

        const result = Object.values(dishMap)
          .map((dish) => ({
            dish_id: dish.dishId,
            dish_name: dish.dishName,
            total_quantity: dish.totalQuantity,
            total_revenue: dish.totalRevenue.toFixed(2),
            order_count: dish.orderCount.size,
          }))
          .sort((a, b) => b.total_quantity - a.total_quantity);

        app.logger.info({ count: result.length }, "Dishes report generated");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to generate dishes report");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/reports/tables
  app.fastify.get<{ Querystring: ReportQuery }>(
    "/api/reports/tables",
    {
      schema: {
        description: "Get per-table statistics",
        tags: ["reports"],
        querystring: {
          type: "object",
          properties: {
            date_from: { type: "string" },
            date_to: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                table_number: { type: "number" },
                orders_count: { type: "number" },
                total_revenue: { type: "string" },
                avg_ticket: { type: "string" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ query: request.query }, "Generating tables report");

        const conditions: any[] = [eq(schema.orders.status, "fechada")];

        if (request.query.date_from) {
          const fromDate = new Date(request.query.date_from);
          conditions.push(gte(schema.orders.closedAt, fromDate));
        }
        if (request.query.date_to) {
          const toDate = new Date(request.query.date_to);
          toDate.setHours(23, 59, 59, 999);
          conditions.push(lte(schema.orders.closedAt, toDate));
        }

        const orders = await app.db
          .select()
          .from(schema.orders)
          .innerJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
          .where(and(...conditions));

        // Filter to only include orders with closedAt set
        const ordersFiltered = orders.filter((o) => o.orders.closedAt !== null);

        // Group by table
        const tableMap: Record<number, any> = {};

        for (const item of ordersFiltered) {
          const tableNumber = item.tables.number;

          if (!tableMap[tableNumber]) {
            tableMap[tableNumber] = {
              tableNumber,
              ordersCount: 0,
              totalRevenue: 0,
            };
          }

          tableMap[tableNumber].ordersCount += 1;
          tableMap[tableNumber].totalRevenue += parseFloat(item.orders.totalAmount);
        }

        const result = Object.values(tableMap).map((table) => ({
          table_number: table.tableNumber,
          orders_count: table.ordersCount,
          total_revenue: table.totalRevenue.toFixed(2),
          avg_ticket: (table.totalRevenue / table.ordersCount).toFixed(2),
        }));

        app.logger.info({ count: result.length }, "Tables report generated");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to generate tables report");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/reports/waiters
  app.fastify.get<{ Querystring: ReportQuery }>(
    "/api/reports/waiters",
    {
      schema: {
        description: "Get per-waiter statistics",
        tags: ["reports"],
        querystring: {
          type: "object",
          properties: {
            date_from: { type: "string" },
            date_to: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                waiter_id: { type: "string" },
                waiter_name: { type: "string" },
                orders_count: { type: "number" },
                total_revenue: { type: "string" },
                avg_ticket: { type: "string" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ query: request.query }, "Generating waiters report");

        const conditions: any[] = [eq(schema.orders.status, "fechada")];

        if (request.query.date_from) {
          const fromDate = new Date(request.query.date_from);
          conditions.push(gte(schema.orders.closedAt, fromDate));
        }
        if (request.query.date_to) {
          const toDate = new Date(request.query.date_to);
          toDate.setHours(23, 59, 59, 999);
          conditions.push(lte(schema.orders.closedAt, toDate));
        }

        const orders = await app.db
          .select()
          .from(schema.orders)
          .innerJoin(userTable, eq(schema.orders.waiterId, userTable.id))
          .where(and(...conditions));

        // Filter to only include orders with closedAt set
        const ordersFiltered = orders.filter((o) => o.orders.closedAt !== null);

        // Group by waiter
        const waiterMap: Record<string, any> = {};

        for (const item of ordersFiltered) {
          const waiterId = item.user.id;
          const waiterName = item.user.name;

          if (!waiterMap[waiterId]) {
            waiterMap[waiterId] = {
              waiterId,
              waiterName,
              ordersCount: 0,
              totalRevenue: 0,
            };
          }

          waiterMap[waiterId].ordersCount += 1;
          waiterMap[waiterId].totalRevenue += parseFloat(item.orders.totalAmount);
        }

        const result = Object.values(waiterMap).map((waiter) => ({
          waiter_id: waiter.waiterId,
          waiter_name: waiter.waiterName,
          orders_count: waiter.ordersCount,
          total_revenue: waiter.totalRevenue.toFixed(2),
          avg_ticket: (waiter.totalRevenue / waiter.ordersCount).toFixed(2),
        }));

        app.logger.info({ count: result.length }, "Waiters report generated");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to generate waiters report");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
