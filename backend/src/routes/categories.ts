import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";
import { requireAuth, requireRole } from "../utils/auth.js";

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
  // GET /api/categories
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
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({}, "Listing categories");

        const categories = await app.db
          .select()
          .from(schema.categories)
          .where(eq(schema.categories.active, true));

        const result = categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          color: c.color,
          icon: c.icon,
          active: c.active,
          created_at: c.createdAt,
        }));

        app.logger.info({ count: result.length }, "Categories listed");
        return result;
      } catch (error) {
        app.logger.error({ err: error }, "Failed to list categories");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  // POST /api/categories
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
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateCategoryBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      if (!request.body.name) {
        return reply.status(400).send({ error: "name is required" });
      }

      try {
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

  // PUT /api/categories/:id
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
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateCategoryBody }>, reply: FastifyReply) => {
      const auth = await requireAuth(app, request, reply);
      if (!auth) return;

      try {
        app.logger.info({ categoryId: request.params.id }, "Updating category");

        const existing = await app.db
          .select()
          .from(schema.categories)
          .where(eq(schema.categories.id, request.params.id))
          .limit(1);

        if (!existing || existing.length === 0) {
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

        return {
          id: updated.id,
          name: updated.name,
          description: updated.description,
          color: updated.color,
          icon: updated.icon,
          active: updated.active,
          created_at: updated.createdAt,
        };
      } catch (error) {
        app.logger.error({ err: error }, "Failed to update category");
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}
