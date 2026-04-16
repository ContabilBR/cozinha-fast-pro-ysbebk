import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth, requireRole } from "../utils/auth.js";

interface CreateDishBody {
  name: string;
  description?: string;
  category_id?: string;
  price: string;
  image_url?: string;
  prep_time_minutes?: number;
  active?: boolean;
}

interface UpdateDishBody {
  name?: string;
  description?: string;
  category_id?: string;
  price?: string;
  image_url?: string;
  prep_time_minutes?: number;
  active?: boolean;
}

export function registerDishRoutes(app: App) {
  // GET /api/dishes
  app.fastify.get(
    "/api/dishes",
    {
      schema: {
        description: "List all dishes with categories",
        tags: ["dishes"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                description: { type: "string" },
                price: { type: "string" },
                image_url: { type: "string" },
                prep_time_minutes: { type: "number" },
                active: { type: "boolean" },
                created_at: { type: "string", format: "date-time" },
                category: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    color: { type: "string" },
                    icon: { type: "string" },
                  },
                },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({}, "Listing dishes");

        const dishes = await app.db
          .select()
          .from(schema.dishes)
          .leftJoin(schema.categories, eq(schema.dishes.categoryId, schema.categories.id));

        const result = dishes.map((row) => ({
          id: row.dishes.id,
          name: row.dishes.name,
          description: row.dishes.description,
          price: row.dishes.price,
          image_url: row.dishes.imageUrl,
          prep_time_minutes: row.dishes.prepTimeMinutes,
          active: row.dishes.active,
          created_at: row.dishes.createdAt,
          category: row.categories
            ? {
                id: row.categories.id,
                name: row.categories.name,
                color: row.categories.color,
                icon: row.categories.icon,
              }
            : null,
        }));

        app.logger.info({ count: result.length }, "Dishes listed");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list dishes");
        return reply.status(500).send({ error: "Internal server error" });
      }
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
            category_id: { type: "string", format: "uuid" },
            price: { type: "string" },
            image_url: { type: "string" },
            prep_time_minutes: { type: "number" },
            active: { type: "boolean" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              price: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateDishBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      if (!request.body.name || !request.body.price) {
        return reply.status(400).send({ error: "name and price are required" });
      }

      try {
        app.logger.info({ name: request.body.name, price: request.body.price }, "Creating dish");

        const [dish] = await app.db
          .insert(schema.dishes)
          .values({
            name: request.body.name,
            description: request.body.description,
            categoryId: request.body.category_id,
            price: request.body.price,
            imageUrl: request.body.image_url,
            prepTimeMinutes: request.body.prep_time_minutes || 15,
            active: request.body.active !== false,
          })
          .returning();

        app.logger.info({ dishId: dish.id }, "Dish created");

        // Fetch with category
        const rows = await app.db
          .select({
            id: schema.dishes.id,
            name: schema.dishes.name,
            description: schema.dishes.description,
            price: schema.dishes.price,
            image_url: schema.dishes.imageUrl,
            prep_time_minutes: schema.dishes.prepTimeMinutes,
            active: schema.dishes.active,
            created_at: schema.dishes.createdAt,
            category_id: schema.categories.id,
            category_name: schema.categories.name,
            category_color: schema.categories.color,
            category_icon: schema.categories.icon,
          })
          .from(schema.dishes)
          .leftJoin(schema.categories, eq(schema.dishes.categoryId, schema.categories.id))
          .where(eq(schema.dishes.id, dish.id));

        if (!rows || rows.length === 0) {
          return reply.status(500).send({ error: "Failed to retrieve created dish" });
        }

        const row = rows[0];
        reply.code(201).send({
          id: row.id,
          name: row.name,
          description: row.description,
          price: row.price,
          image_url: row.image_url,
          prep_time_minutes: row.prep_time_minutes,
          active: row.active,
          created_at: row.created_at,
          category: row.category_id
            ? {
                id: row.category_id,
                name: row.category_name,
                color: row.category_color,
                icon: row.category_icon,
              }
            : null,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to create dish");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // GET /api/dishes/:id
  app.fastify.get<{ Params: { id: string } }>(
    "/api/dishes/:id",
    {
      schema: {
        description: "Get a dish by ID",
        tags: ["dishes"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: { type: "object" },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ dishId: request.params.id }, "Getting dish");

        const rows = await app.db
          .select({
            id: schema.dishes.id,
            name: schema.dishes.name,
            description: schema.dishes.description,
            price: schema.dishes.price,
            image_url: schema.dishes.imageUrl,
            prep_time_minutes: schema.dishes.prepTimeMinutes,
            active: schema.dishes.active,
            created_at: schema.dishes.createdAt,
            category_id: schema.categories.id,
            category_name: schema.categories.name,
            category_color: schema.categories.color,
            category_icon: schema.categories.icon,
          })
          .from(schema.dishes)
          .leftJoin(schema.categories, eq(schema.dishes.categoryId, schema.categories.id))
          .where(eq(schema.dishes.id, request.params.id))
          .limit(1);

        if (!rows || rows.length === 0) {
          return reply.status(404).send({ error: "Dish not found" });
        }

        const row = rows[0];
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          price: row.price,
          image_url: row.image_url,
          prep_time_minutes: row.prep_time_minutes,
          active: row.active,
          created_at: row.created_at,
          category: row.category_id
            ? {
                id: row.category_id,
                name: row.category_name,
                color: row.category_color,
                icon: row.category_icon,
              }
            : null,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to get dish");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/dishes/:id
  app.fastify.put<{ Params: { id: string }; Body: UpdateDishBody }>(
    "/api/dishes/:id",
    {
      schema: {
        description: "Update a dish",
        tags: ["dishes"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            category_id: { type: "string", format: "uuid" },
            price: { type: "string" },
            image_url: { type: "string" },
            prep_time_minutes: { type: "number" },
            active: { type: "boolean" },
          },
        },
        response: {
          200: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateDishBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ dishId: request.params.id }, "Updating dish");

        const existing = await app.db
          .select()
          .from(schema.dishes)
          .where(eq(schema.dishes.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
          return reply.status(404).send({ error: "Dish not found" });
        }

        const updates: any = {};
        if (request.body.name !== undefined) updates.name = request.body.name;
        if (request.body.description !== undefined) updates.description = request.body.description;
        if (request.body.category_id !== undefined) updates.categoryId = request.body.category_id;
        if (request.body.price !== undefined) updates.price = request.body.price;
        if (request.body.image_url !== undefined) updates.imageUrl = request.body.image_url;
        if (request.body.prep_time_minutes !== undefined) updates.prepTimeMinutes = request.body.prep_time_minutes;
        if (request.body.active !== undefined) updates.active = request.body.active;

        const [updated] = await app.db
          .update(schema.dishes)
          .set(updates)
          .where(eq(schema.dishes.id, request.params.id))
          .returning();

        // Fetch with category
        const rows = await app.db
          .select({
            id: schema.dishes.id,
            name: schema.dishes.name,
            description: schema.dishes.description,
            price: schema.dishes.price,
            image_url: schema.dishes.imageUrl,
            prep_time_minutes: schema.dishes.prepTimeMinutes,
            active: schema.dishes.active,
            created_at: schema.dishes.createdAt,
            category_id: schema.categories.id,
            category_name: schema.categories.name,
            category_color: schema.categories.color,
            category_icon: schema.categories.icon,
          })
          .from(schema.dishes)
          .leftJoin(schema.categories, eq(schema.dishes.categoryId, schema.categories.id))
          .where(eq(schema.dishes.id, updated.id));

        const row = rows[0];
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          price: row.price,
          image_url: row.image_url,
          prep_time_minutes: row.prep_time_minutes,
          active: row.active,
          created_at: row.created_at,
          category: row.category_id
            ? {
                id: row.category_id,
                name: row.category_name,
                color: row.category_color,
                icon: row.category_icon,
              }
            : null,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update dish");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/dishes/:id
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/dishes/:id",
    {
      schema: {
        description: "Delete a dish",
        tags: ["dishes"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ dishId: request.params.id }, "Deleting dish");

        const existing = await app.db
          .select()
          .from(schema.dishes)
          .where(eq(schema.dishes.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
          return reply.status(404).send({ error: "Dish not found" });
        }

        await app.db.delete(schema.dishes).where(eq(schema.dishes.id, request.params.id));

        app.logger.info({ dishId: request.params.id }, "Dish deleted");
        return { success: true };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete dish");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
