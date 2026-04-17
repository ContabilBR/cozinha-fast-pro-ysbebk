import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, count } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth } from "../utils/auth.js";

interface CreateCategoryBody {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface UpdateCategoryBody {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  active?: boolean;
}

export function registerCategoryRoutes(app: App) {
  // GET /api/categories - List all active categories
  app.fastify.get(
    "/api/categories",
    {
      schema: {
        description: "List all active categories",
        tags: ["categories"],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                description: { type: "string" },
                color: { type: "string" },
                icon: { type: "string" },
                active: { type: "boolean" },
                created_at: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        app.logger.info({}, "Listing active categories");

        const categories = await app.db
          .select({
            id: schema.categories.id,
            name: schema.categories.name,
            description: schema.categories.description,
            color: schema.categories.color,
            icon: schema.categories.icon,
            active: schema.categories.active,
            created_at: schema.categories.createdAt,
            dish_count: count(schema.dishes.id),
          })
          .from(schema.categories)
          .leftJoin(schema.dishes, eq(schema.categories.id, schema.dishes.categoryId))
          .where(eq(schema.categories.active, true))
          .groupBy(schema.categories.id)
          .orderBy(schema.categories.name);

        return categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          color: c.color,
          icon: c.icon,
          active: c.active,
          created_at: c.created_at,
          dish_count: c.dish_count,
        }));
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list categories");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/categories - Create a new category
  app.fastify.post<{ Body: CreateCategoryBody }>(
    "/api/categories",
    {
      schema: {
        description: "Create a new category",
        tags: ["categories"],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            color: { type: "string" },
            icon: { type: "string" },
          },
        },
        response: {
          201: { type: "object" },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateCategoryBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        if (!request.body.name) {
          return reply.status(400).send({ error: "name is required" });
        }

        app.logger.info({ name: request.body.name }, "Creating category");

        const [category] = await app.db
          .insert(schema.categories)
          .values({
            name: request.body.name,
            description: request.body.description,
            color: request.body.color,
            icon: request.body.icon,
            active: true,
          })
          .returning();

        app.logger.info({ categoryId: category.id }, "Category created");

        return reply.status(201).send({
          id: category.id,
          name: category.name,
          description: category.description,
          color: category.color,
          icon: category.icon,
          active: category.active,
          created_at: category.createdAt,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to create category");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // PUT /api/categories/:id - Update a category
  app.fastify.put<{ Params: { id: string }; Body: UpdateCategoryBody }>(
    "/api/categories/:id",
    {
      schema: {
        description: "Update a category",
        tags: ["categories"],
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
            color: { type: "string" },
            icon: { type: "string" },
            active: { type: "boolean" },
          },
        },
        response: {
          200: { type: "object" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateCategoryBody }>,
      reply: FastifyReply
    ) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ categoryId: request.params.id }, "Updating category");

        const existing = await app.db
          .select()
          .from(schema.categories)
          .where(eq(schema.categories.id, request.params.id));

        if (!existing.length) {
          return reply.status(404).send({ error: "Category not found" });
        }

        const updates: any = {};
        if (request.body.name !== undefined) updates.name = request.body.name;
        if (request.body.description !== undefined) updates.description = request.body.description;
        if (request.body.color !== undefined) updates.color = request.body.color;
        if (request.body.icon !== undefined) updates.icon = request.body.icon;
        if (request.body.active !== undefined) updates.active = request.body.active;

        const [updated] = await app.db
          .update(schema.categories)
          .set(updates)
          .where(eq(schema.categories.id, request.params.id))
          .returning();

        app.logger.info({ categoryId: updated.id }, "Category updated");

        return reply.status(200).send({
          id: updated.id,
          name: updated.name,
          description: updated.description,
          color: updated.color,
          icon: updated.icon,
          active: updated.active,
          created_at: updated.createdAt,
        });
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update category");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // DELETE /api/categories/:id - Delete (deactivate) a category
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/categories/:id",
    {
      schema: {
        description: "Delete a category",
        tags: ["categories"],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        response: {
          204: { description: "Category deleted" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ categoryId: request.params.id }, "Deleting category");

        const existing = await app.db
          .select()
          .from(schema.categories)
          .where(eq(schema.categories.id, request.params.id));

        if (!existing.length) {
          return reply.status(404).send({ error: "Category not found" });
        }

        await app.db
          .update(schema.categories)
          .set({ active: false })
          .where(eq(schema.categories.id, request.params.id));

        app.logger.info({ categoryId: request.params.id }, "Category deleted");

        return reply.status(204).send();
      } catch (error) {
        app.logger.error({ err: error }, "Failed to delete category");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
