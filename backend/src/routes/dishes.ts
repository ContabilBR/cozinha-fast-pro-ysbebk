import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and, inArray } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

interface CreateDishBody {
  name: string;
  description?: string;
  categoryId?: string;
  price: string;
  imageUrl?: string;
  prepTimeMinutes?: number;
}

interface UpdateDishBody {
  name?: string;
  description?: string;
  categoryId?: string;
  price?: string;
  imageUrl?: string;
  prepTimeMinutes?: number;
  active?: boolean;
}

interface DishQuery {
  category_id?: string;
  active?: string;
}

export function registerDishRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // GET /api/dishes
  app.fastify.get<{ Querystring: DishQuery }>(
    "/api/dishes",
    {
      schema: {
        description: "List dishes with category info joined",
        tags: ["dishes"],
        querystring: {
          type: "object",
          properties: {
            category_id: { type: "string", format: "uuid" },
            active: { type: "string" },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                description: { type: "string" },
                categoryId: { type: "string", format: "uuid" },
                price: { type: "string" },
                imageUrl: { type: "string" },
                prepTimeMinutes: { type: "number" },
                active: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: DishQuery }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ query: request.query }, "Listing dishes");

      const conditions: any[] = [];
      if (request.query.category_id) {
        conditions.push(eq(schema.dishes.categoryId, request.query.category_id));
      }

      if (request.query.active) {
        const isActive = request.query.active === "true";
        conditions.push(eq(schema.dishes.active, isActive));
      }

      let dishes;
      if (conditions.length > 0) {
        dishes = await app.db.select().from(schema.dishes).where(and(...conditions));
      } else {
        dishes = await app.db.select().from(schema.dishes);
      }

      app.logger.info({ count: dishes.length }, "Dishes listed");
      return dishes;
    }
  );

  // POST /api/dishes
  app.fastify.post<{ Body: CreateDishBody }>(
    "/api/dishes",
    {
      schema: {
        description: "Create a new dish",
        tags: ["dishes"],
        body: {
          type: "object",
          required: ["name", "price"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            categoryId: { type: "string", format: "uuid" },
            price: { type: "string" },
            imageUrl: { type: "string" },
            prepTimeMinutes: { type: "number" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: "string" },
              categoryId: { type: "string", format: "uuid" },
              price: { type: "string" },
              imageUrl: { type: "string" },
              prepTimeMinutes: { type: "number" },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateDishBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ name: request.body.name, price: request.body.price }, "Creating dish");

      const [created] = await app.db
        .insert(schema.dishes)
        .values({
          name: request.body.name,
          description: request.body.description,
          categoryId: request.body.categoryId,
          price: request.body.price,
          imageUrl: request.body.imageUrl,
          prepTimeMinutes: request.body.prepTimeMinutes || 15,
          active: true,
        })
        .returning();

      app.logger.info({ dishId: created.id }, "Dish created");
      return reply.status(201).send(created);
    }
  );

  // PUT /api/dishes/:id
  app.fastify.put<{ Params: { id: string }; Body: UpdateDishBody }>(
    "/api/dishes/:id",
    {
      schema: {
        description: "Update dish",
        tags: ["dishes"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            categoryId: { type: "string", format: "uuid" },
            price: { type: "string" },
            imageUrl: { type: "string" },
            prepTimeMinutes: { type: "number" },
            active: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: "string" },
              categoryId: { type: "string", format: "uuid" },
              price: { type: "string" },
              imageUrl: { type: "string" },
              prepTimeMinutes: { type: "number" },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateDishBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ dishId: request.params.id, body: request.body }, "Updating dish");

      const existing = await app.db.query.dishes.findFirst({
        where: eq(schema.dishes.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ dishId: request.params.id }, "Dish not found");
        return reply.status(404).send({ error: "Dish not found" });
      }

      const updates: any = {};
      if (request.body.name !== undefined) updates.name = request.body.name;
      if (request.body.description !== undefined) updates.description = request.body.description;
      if (request.body.categoryId !== undefined) updates.categoryId = request.body.categoryId;
      if (request.body.price !== undefined) updates.price = request.body.price;
      if (request.body.imageUrl !== undefined) updates.imageUrl = request.body.imageUrl;
      if (request.body.prepTimeMinutes !== undefined) updates.prepTimeMinutes = request.body.prepTimeMinutes;
      if (request.body.active !== undefined) updates.active = request.body.active;

      const [updated] = await app.db
        .update(schema.dishes)
        .set(updates)
        .where(eq(schema.dishes.id, request.params.id))
        .returning();

      app.logger.info({ dishId: updated.id }, "Dish updated");
      return updated;
    }
  );

  // DELETE /api/dishes/:id
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/dishes/:id",
    {
      schema: {
        description: "Deactivate dish (set active=false)",
        tags: ["dishes"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: { type: "object", properties: { message: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ dishId: request.params.id }, "Deactivating dish");

      const existing = await app.db.query.dishes.findFirst({
        where: eq(schema.dishes.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ dishId: request.params.id }, "Dish not found");
        return reply.status(404).send({ error: "Dish not found" });
      }

      await app.db.update(schema.dishes).set({ active: false }).where(eq(schema.dishes.id, request.params.id));

      app.logger.info({ dishId: request.params.id }, "Dish deactivated");
      return { message: "Dish deactivated" };
    }
  );
}
