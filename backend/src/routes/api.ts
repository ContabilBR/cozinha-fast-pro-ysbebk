import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import { user as userTable } from "../db/schema/auth-schema.js";
import type { App } from "../index.js";

export function registerApiRoutes(app: App) {
  // GET /api/mesas
  app.fastify.get(
    "/api/mesas",
    {
      schema: {
        description: "List all tables",
        tags: ["api"],
        response: {
          200: {
            type: "object",
            properties: {
              mesas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    number: { type: "number" },
                    capacity: { type: "number" },
                    location: { type: "string" },
                    status: { type: "string" },
                    active: { type: "boolean" },
                    created_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing mesas");

        const tables = await app.db
          .select()
          .from(schema.tables)
          .where(eq(schema.tables.active, true));

        return reply.status(200).send({
          mesas: tables.map((t) => ({
            id: t.id,
            number: t.number,
            capacity: t.capacity,
            location: t.location,
            status: t.status,
            active: t.active,
            created_at: t.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list mesas");
        reply.status(500);
        return { error: "Internal server error" };
      }
    }
  );

  // GET /api/categorias
  app.fastify.get(
    "/api/categorias",
    {
      schema: {
        description: "List all categories",
        tags: ["api"],
        response: {
          200: {
            type: "object",
            properties: {
              categorias: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    icon: { type: "string" },
                    color: { type: "string" },
                    active: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing categorias");

        const categories = await app.db
          .select()
          .from(schema.categories)
          .where(eq(schema.categories.active, true));

        return reply.status(200).send({
          categorias: categories.map((c) => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            color: c.color,
            active: c.active,
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list categorias");
        reply.status(500);
        return { error: "Internal server error" };
      }
    }
  );

  // GET /api/pratos
  app.fastify.get(
    "/api/pratos",
    {
      schema: {
        description: "List all dishes",
        tags: ["api"],
        response: {
          200: {
            type: "object",
            properties: {
              pratos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    category: { type: "string" },
                    price: { type: "string" },
                    image_url: { type: "string" },
                    prep_time: { type: "number" },
                    active: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing pratos");

        const dishes = await app.db
          .select({
            id: schema.dishes.id,
            name: schema.dishes.name,
            categoryId: schema.dishes.categoryId,
            categoryName: schema.categories.name,
            price: schema.dishes.price,
            imageUrl: schema.dishes.imageUrl,
            prepTimeMinutes: schema.dishes.prepTimeMinutes,
            active: schema.dishes.active,
          })
          .from(schema.dishes)
          .where(eq(schema.dishes.active, true))
          .leftJoin(schema.categories, eq(schema.dishes.categoryId, schema.categories.id));

        return reply.status(200).send({
          pratos: dishes.map((d) => ({
            id: d.id,
            name: d.name,
            category: d.categoryName || "Sem categoria",
            price: d.price,
            image_url: d.imageUrl,
            prep_time: d.prepTimeMinutes,
            active: d.active,
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list pratos");
        reply.status(500);
        return { error: "Internal server error" };
      }
    }
  );

  // GET /api/comandas
  app.fastify.get(
    "/api/comandas",
    {
      schema: {
        description: "List open orders",
        tags: ["api"],
        response: {
          200: {
            type: "object",
            properties: {
              comandas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    mesa: { type: "number" },
                    status: { type: "string" },
                    total: { type: "string" },
                    items_count: { type: "number" },
                    opened_at: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing comandas");

        const orders = await app.db
          .select({
            id: schema.orders.id,
            tableNumber: schema.tables.number,
            status: schema.orders.status,
            totalAmount: schema.orders.totalAmount,
            openedAt: schema.orders.openedAt,
          })
          .from(schema.orders)
          .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id));

        // Count items for each order
        const comandas = await Promise.all(
          orders.map(async (order) => {
            const items = await app.db
              .select()
              .from(schema.orderItems)
              .where(eq(schema.orderItems.orderId, order.id));

            return {
              id: order.id,
              mesa: order.tableNumber || 0,
              status: order.status,
              total: order.totalAmount,
              items_count: items.length,
              opened_at: order.openedAt.toISOString(),
            };
          })
        );

        return reply.status(200).send({ comandas });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list comandas");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/usuarios
  app.fastify.get(
    "/api/usuarios",
    {
      schema: {
        description: "List all users",
        tags: ["api"],
        response: {
          200: {
            type: "object",
            properties: {
              usuarios: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                    role: { type: "string" },
                    active: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing usuarios");

        const usuarios = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.active, true));

        return reply.status(200).send({
          usuarios: usuarios.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: u.active,
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list usuarios");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/cozinha
  app.fastify.get(
    "/api/cozinha",
    {
      schema: {
        description: "List pending kitchen items",
        tags: ["api"],
        response: {
          200: {
            type: "object",
            properties: {
              itens: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    prato: { type: "string" },
                    mesa: { type: "number" },
                    quantidade: { type: "number" },
                    status: { type: "string" },
                    solicitado_em: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing cozinha items");

        const items = await app.db
          .select({
            id: schema.orderItems.id,
            dishName: schema.dishes.name,
            tableNumber: schema.tables.number,
            quantity: schema.orderItems.quantity,
            status: schema.orderItems.status,
            requestedAt: schema.orderItems.requestedAt,
          })
          .from(schema.orderItems)
          .leftJoin(schema.dishes, eq(schema.orderItems.dishId, schema.dishes.id))
          .leftJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .leftJoin(schema.tables, eq(schema.orders.tableId, schema.tables.id))
          .where(inArray(schema.orderItems.status, ["pendente", "em_preparo"]));

        return reply.status(200).send({
          itens: items.map((item) => ({
            id: item.id,
            prato: item.dishName || "Desconhecido",
            mesa: item.tableNumber || 0,
            quantidade: item.quantity,
            status: item.status,
            solicitado_em: item.requestedAt?.toISOString(),
          })),
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list cozinha items");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/relatorios/resumo
  app.fastify.get(
    "/api/relatorios/resumo",
    {
      schema: {
        description: "Get summary report",
        tags: ["api"],
        response: {
          200: {
            type: "object",
            properties: {
              totalPedidosHoje: { type: "number" },
              receitaHoje: { type: "number" },
              mesasAtivas: { type: "number" },
              itensPendentes: { type: "number" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Getting relatorio resumo");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Count orders created today
        const orders = await app.db
          .select()
          .from(schema.orders);

        const todayOrders = orders.filter(
          (o) => new Date(o.createdAt).getTime() >= today.getTime()
        );

        // Calculate revenue from today's orders
        const receitaHoje = todayOrders.reduce((sum, order) => {
          return sum + parseFloat(order.totalAmount || "0");
        }, 0);

        // Count active tables
        const tables = await app.db
          .select()
          .from(schema.tables)
          .where(eq(schema.tables.status, "ocupada"));

        // Count pending items
        const pendingItems = await app.db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.status, "pendente"));

        return reply.status(200).send({
          totalPedidosHoje: todayOrders.length,
          receitaHoje: Math.round(receitaHoje * 100) / 100,
          mesasAtivas: tables.length,
          itensPendentes: pendingItems.length,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get relatorio resumo");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
