import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

interface ReportQuery {
  date_from?: string;
  date_to?: string;
}

export function registerReportRoutes(app: App) {
  const requireAuth = app.requireAuth();

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
              totalRevenue: { type: "string" },
              ordersCount: { type: "number" },
              avgTicket: { type: "string" },
              cancelledCount: { type: "number" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

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
      const closedOrdersFiltered = closedOrders.filter(o => o.closedAt !== null);

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
        totalRevenue: totalRevenue.toFixed(2),
        ordersCount: closedOrdersFiltered.length,
        avgTicket: avgTicket.toFixed(2),
        cancelledCount: cancelledOrders.length,
      };
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
                dishId: { type: "string", format: "uuid" },
                dishName: { type: "string" },
                totalQuantity: { type: "number" },
                totalRevenue: { type: "string" },
                orderCount: { type: "number" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ query: request.query }, "Generating dishes report");

      let itemsQuery = app.db
        .select()
        .from(schema.orderItems)
        .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
        .innerJoin(schema.dishes, eq(schema.orderItems.dishId, schema.dishes.id));

      // Filter by order status (only closed orders)
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

      const items = await itemsQuery.where(and(...baseConditions));

      // Filter to only include orders with closedAt set
      const itemsFiltered = items.filter(item => item.orders.closedAt !== null);

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
          dishId: dish.dishId,
          dishName: dish.dishName,
          totalQuantity: dish.totalQuantity,
          totalRevenue: dish.totalRevenue.toFixed(2),
          orderCount: dish.orderCount.size,
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity);

      app.logger.info({ count: result.length }, "Dishes report generated");
      return result;
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
                tableNumber: { type: "number" },
                ordersCount: { type: "number" },
                totalRevenue: { type: "string" },
                avgTicket: { type: "string" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

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
      const ordersFiltered = orders.filter(o => o.orders.closedAt !== null);

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
        tableNumber: table.tableNumber,
        ordersCount: table.ordersCount,
        totalRevenue: table.totalRevenue.toFixed(2),
        avgTicket: (table.totalRevenue / table.ordersCount).toFixed(2),
      }));

      app.logger.info({ count: result.length }, "Tables report generated");
      return result;
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
                waiterId: { type: "string" },
                waiterName: { type: "string" },
                ordersCount: { type: "number" },
                totalRevenue: { type: "string" },
                avgTicket: { type: "string" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: ReportQuery }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

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
      const ordersFiltered = orders.filter(o => o.orders.closedAt !== null);

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
        waiterId: waiter.waiterId,
        waiterName: waiter.waiterName,
        ordersCount: waiter.ordersCount,
        totalRevenue: waiter.totalRevenue.toFixed(2),
        avgTicket: (waiter.totalRevenue / waiter.ordersCount).toFixed(2),
      }));

      app.logger.info({ count: result.length }, "Waiters report generated");
      return result;
    }
  );
}
