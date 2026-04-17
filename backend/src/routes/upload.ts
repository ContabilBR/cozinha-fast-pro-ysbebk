import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";

interface UploadImageBody {
  base64?: string;
  filename: string;
}

export function registerUploadRoutes(app: App) {
  // POST /api/upload/imagem - Upload image
  app.fastify.post<{ Body: UploadImageBody }>(
    "/api/upload/imagem",
    {
      schema: {
        description: "Upload an image",
        tags: ["upload"],
        body: {
          type: "object",
          required: ["filename"],
          properties: {
            base64: { type: "string" },
            filename: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              url: { type: "string" },
            },
          },
          400: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: UploadImageBody }>, reply: FastifyReply) => {
      try {
        if (!request.body.filename) {
          return reply.code(400).send({ error: "filename is required" });
        }

        app.logger.info({ filename: request.body.filename }, "Uploading image");

        // Generate deterministic URL based on filename
        const url = `https://picsum.photos/seed/${request.body.filename}/400/300`;

        app.logger.info({ filename: request.body.filename, url }, "Image upload successful");

        return reply.code(200).send({ url });
      } catch (error) {
        app.logger.error({ err: error, body: request.body }, "Failed to upload image");
        return reply.code(500).send({ error: "Internal server error" });
      }
    }
  );
}
