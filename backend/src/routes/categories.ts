import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/schema.js";
import type { App } from "../index.js";

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
  const requireAuth = app.requireAuth();

  // GET /api/categories
  app.fastify.get(
    "/api/categories",
    {
      schema: {
        description: "List all categories",
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
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({}, "Listing categories");
      const categories = await app.db.select().from(schema.categories);
      app.logger.info({ count: categories.length }, "Categories listed");
      return categories;
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
          201: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: "string" },
              color: { type: "string" },
              icon: { type: "string" },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateCategoryBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ name: request.body.name }, "Creating category");

      const [created] = await app.db
        .insert(schema.categories)
        .values({
          name: request.body.name,
          description: request.body.description,
          color: request.body.color,
          icon: request.body.icon,
          active: true,
        })
        .returning();

      app.logger.info({ categoryId: created.id }, "Category created");
      return reply.status(201).send(created);
    }
  );

  // PUT /api/categories/:id
  app.fastify.put<{ Params: { id: string }; Body: UpdateCategoryBody }>(
    "/api/categories/:id",
    {
      schema: {
        description: "Update category",
        tags: ["categories"],
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
            color: { type: "string" },
            icon: { type: "string" },
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
              color: { type: "string" },
              icon: { type: "string" },
              active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateCategoryBody }>, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      app.logger.info({ categoryId: request.params.id, body: request.body }, "Updating category");

      const existing = await app.db.query.categories.findFirst({
        where: eq(schema.categories.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ categoryId: request.params.id }, "Category not found");
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
      return updated;
    }
  );

  // DELETE /api/categories/:id
  app.fastify.delete<{ Params: { id: string } }>(
    "/api/categories/:id",
    {
      schema: {
        description: "Delete category",
        tags: ["categories"],
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

      app.logger.info({ categoryId: request.params.id }, "Deleting category");

      const existing = await app.db.query.categories.findFirst({
        where: eq(schema.categories.id, request.params.id),
      });

      if (!existing) {
        app.logger.warn({ categoryId: request.params.id }, "Category not found");
        return reply.status(404).send({ error: "Category not found" });
      }

      await app.db.delete(schema.categories).where(eq(schema.categories.id, request.params.id));

      app.logger.info({ categoryId: request.params.id }, "Category deleted");
      return { message: "Category deleted" };
    }
  );
}
