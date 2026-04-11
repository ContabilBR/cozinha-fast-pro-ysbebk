import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerUserRoutes } from './routes/users.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerDishRoutes } from './routes/dishes.js';
import { registerTableRoutes } from './routes/tables.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerOrderItemRoutes } from './routes/order-items.js';
import { registerKitchenRoutes } from './routes/kitchen.js';
import { registerReportRoutes } from './routes/reports.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { seedDatabase } from './db/seed.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Set up authentication
app.withAuth();

// Register routes - IMPORTANT: Always use registration functions to avoid circular dependency issues
registerUserRoutes(app);
registerCategoryRoutes(app);
registerDishRoutes(app);
registerTableRoutes(app);
registerOrderRoutes(app);
registerOrderItemRoutes(app);
registerKitchenRoutes(app);
registerReportRoutes(app);
registerDashboardRoutes(app);

// Seed database on startup
await seedDatabase(app);

await app.run();
app.logger.info('Application running');
