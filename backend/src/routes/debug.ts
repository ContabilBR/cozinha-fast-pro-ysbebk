import type { App } from '../index.js';

export function registerDebugRoutes(app: App) {
  app.fastify.get('/debug/notas-fiscais-columns', {
    schema: {
      description: 'Get column information for notas_fiscais table (debug endpoint)',
      tags: ['debug'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column_name: { type: 'string' },
              data_type: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    app.logger.info('GET /debug/notas-fiscais-columns - retrieving notas_fiscais columns');

    try {
      // Step 1: Execute ALTER TABLE to add columns if they don't exist
      app.logger.info('Executing ALTER TABLE to add qrcode_url and url_consulta columns');
      await (app.db as any).execute(`
        ALTER TABLE notas_fiscais
          ADD COLUMN IF NOT EXISTS qrcode_url   TEXT,
          ADD COLUMN IF NOT EXISTS url_consulta TEXT;
      `);
      app.logger.info('ALTER TABLE executed successfully');

      // Step 2: Query column information
      app.logger.info('Querying column information from information_schema');
      const result = await (app.db as any).execute(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'notas_fiscais'
        ORDER BY ordinal_position;
      `);

      app.logger.info(
        { columnCount: result.rows?.length || 0 },
        'Retrieved notas_fiscais column information successfully'
      );

      return result.rows || [];
    } catch (error) {
      app.logger.error(
        { err: error },
        'Failed to retrieve notas_fiscais column information'
      );
      throw error;
    }
  });
}
