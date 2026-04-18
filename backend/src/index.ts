import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerCustomAuthRoutes } from './routes/auth-custom.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerUserRoutes } from './routes/users.js';
import { registerDishRoutes } from './routes/dishes.js';
import { registerTableRoutes } from './routes/tables.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerOrderItemRoutes } from './routes/order-items.js';
import { registerCategoriasRoutes } from './routes/categorias.js';
import { registerUsuariosRoutes } from './routes/usuarios.js';
import { registerRelatoriosRoutes } from './routes/relatorios.js';
import { registerUploadRoutes } from './routes/upload.js';
import { registerGarconRoutes } from './routes/garcons.js';
import { registerDebugRoutes } from './routes/debug.js';
import { seedDatabase } from './db/seed.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);
app.withStorage();

// Configure Better Auth with minimal settings
// The framework version doesn't expose additionalFields config
// Better Auth will auto-detect the user table columns (role, active)
app.withAuth();

// Export App type for use in route files
export type App = typeof app;

// Add global error handler for debugging - only catch unexpected errors
app.fastify.setErrorHandler((error: any, request, reply) => {
  // Let Fastify handle validation errors (FST_ERR_*) and other framework errors
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  // Log unexpected 5xx errors with full stack trace
  app.logger.error(
    {
      err: error,
      stack: error.stack,
      url: request.url,
      method: request.method,
    },
    'Global error handler'
  );
  console.error('Full error stack:', error.stack);
  reply.status(500).send({ error: error.message });
});

// Run startup SQL migrations - convert role column to TEXT type first
app.logger.info('Running startup SQL migrations');
try {
  // First, ensure role column is TEXT type (safety measure)
  app.logger.info('Converting role column to TEXT type');
  try {
    await (app.db as any).execute(`ALTER TABLE "user" ALTER COLUMN role TYPE text USING role::text;`);
    app.logger.info('Role column converted to TEXT');
  } catch (err) {
    app.logger.debug({ err }, 'Role column conversion failed (may already be TEXT)');
  }

  // Execute column default and constraint statements
  await (app.db as any).execute(`ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'garcom';`);
  await (app.db as any).execute(`ALTER TABLE "user" ALTER COLUMN active SET DEFAULT true;`);
  await (app.db as any).execute(`ALTER TABLE "user" ALTER COLUMN role DROP NOT NULL;`);
  await (app.db as any).execute(`ALTER TABLE "user" ALTER COLUMN active DROP NOT NULL;`);
  app.logger.info('Startup SQL migrations completed');
} catch (err) {
  app.logger.warn({ err }, 'Startup SQL migrations failed (may already be applied)');
}

// Register routes - IMPORTANT: Always use registration functions to avoid circular dependency issues
// Register custom auth routes FIRST so they take priority
registerCustomAuthRoutes(app);
registerAuthRoutes(app);
registerUserRoutes(app);
registerDishRoutes(app);
registerTableRoutes(app);
registerOrderRoutes(app);
registerOrderItemRoutes(app);
registerCategoriasRoutes(app);
registerUsuariosRoutes(app);
registerRelatoriosRoutes(app);
registerUploadRoutes(app);
registerGarconRoutes(app);
registerDebugRoutes(app);

// Seed database on startup
await seedDatabase(app);

await app.run();
app.logger.info('Application running');
