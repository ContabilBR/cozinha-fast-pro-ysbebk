import type { App } from '../index.js';
import * as schema from '../db/schema/schema.js';

export function registerRestaurantRoutes(app: App) {
  // GET /api/mesas - list all mesas ordered by numero
  app.fastify.get<{}>('/api/mesas', {
    schema: {
      description: 'List all mesas ordered by numero',
      tags: ['mesas'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              numero: { type: 'number' },
              status: { type: 'string' },
              capacidade: { type: 'number' },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    app.logger.info('Fetching all mesas');
    try {
      const mesas = await app.db
        .select()
        .from(schema.mesas);
      return mesas;
    } catch (err) {
      app.logger.error({ err }, 'Failed to fetch mesas');
      throw err;
    }
  });
}
