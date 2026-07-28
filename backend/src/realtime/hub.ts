export interface RealtimeEvent {
  type: string;
  entityId: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
}

interface Connection {
  ws: any;
  restauranteId: string;
}

class RealtimeHub {
  private connections = new Map<string, Connection>();
  private tenantConnections = new Map<string, Set<string>>();
  private connectionCounter = 0;

  registerConnection(ws: any, restauranteId: string): string {
    const connectionId = `conn_${++this.connectionCounter}`;
    this.connections.set(connectionId, { ws, restauranteId });

    if (!this.tenantConnections.has(restauranteId)) {
      this.tenantConnections.set(restauranteId, new Set());
    }
    this.tenantConnections.get(restauranteId)!.add(connectionId);

    return connectionId;
  }

  deregisterConnection(id: string): void {
    const conn = this.connections.get(id);
    if (!conn) return;

    this.connections.delete(id);
    const tenantSet = this.tenantConnections.get(conn.restauranteId);
    if (tenantSet) {
      tenantSet.delete(id);
      if (tenantSet.size === 0) {
        this.tenantConnections.delete(conn.restauranteId);
      }
    }
  }

  publish(restauranteId: string, event: RealtimeEvent): void {
    const connectionIds = this.tenantConnections.get(restauranteId);
    if (!connectionIds) return;

    const message = JSON.stringify(event);
    for (const connectionId of connectionIds) {
      const conn = this.connections.get(connectionId);
      if (!conn) continue;

      try {
        if (conn.ws.readyState === 1) { // OPEN
          conn.ws.send(message);
        }
      } catch (err) {
        // Ignore send errors
      }
    }
  }

  getTenantConnectionCount(restauranteId: string): number {
    return this.tenantConnections.get(restauranteId)?.size || 0;
  }
}

export const realtimeHub = new RealtimeHub();
