import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
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
import { seedDatabase } from './db/seed.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Register routes - IMPORTANT: Always use registration functions to avoid circular dependency issues
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

// Seed database on startup
await seedDatabase(app);

await app.run();
app.logger.info('Application running');
