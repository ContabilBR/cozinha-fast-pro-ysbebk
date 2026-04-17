import * as schema from "./schema/schema.js";
import type { App } from "../index.js";

export async function cleanupTables(app: App) {
  try {
    app.logger.info("Starting cleanup of mesas and comandas tables");

    // Delete from comandas first (has foreign key to mesas)
    app.logger.info("Deleting all rows from comandas");
    const comandasResult = await app.db.delete(schema.comandas);
    app.logger.info("Comandas table cleared");

    // Then delete from mesas
    app.logger.info("Deleting all rows from mesas");
    const mesasResult = await app.db.delete(schema.mesas);
    app.logger.info("Mesas table cleared");

    app.logger.info("Cleanup completed successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to cleanup tables");
    throw error;
  }
}
