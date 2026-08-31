import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Configuration for rate limiting on a specific route
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

/**
 * Internal tracking data for a specific client IP
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory storage: route path -> client IP -> rate limit entry
 */
type RateLimitStore = Map<string, Map<string, RateLimitEntry>>;

const store: RateLimitStore = new Map();

/**
 * Default cleanup interval: run every 5 minutes to remove expired entries
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Start the periodic cleanup task to prevent memory leaks
 */
export function initRateLimitCleanup(): NodeJS.Timer {
  return setInterval(() => {
    cleanupExpiredEntries();
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Remove expired entries from the store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const routePaths = Array.from(store.keys());

  for (const routePath of routePaths) {
    const clients = store.get(routePath);
    if (!clients) continue;

    const expiredIPs = Array.from(clients.entries())
      .filter(([_, entry]) => entry.resetAt < now)
      .map(([ip]) => ip);

    for (const ip of expiredIPs) {
      clients.delete(ip);
    }

    // Remove the route from store if no clients left
    if (clients.size === 0) {
      store.delete(routePath);
    }
  }
}

/**
 * Extract the client's real IP address from the request
 * Checks X-Forwarded-For header first (for reverse proxy setups), then falls back to request IP
 */
export function getClientKey(request: FastifyRequest): string {
  const xForwardedFor = request.headers["x-forwarded-for"];

  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2...)
    // The first one is the client's original IP
    const ips = Array.isArray(xForwardedFor) ? xForwardedFor : xForwardedFor.split(",");
    const clientIp = ips[0]?.trim();
    if (clientIp) {
      return clientIp;
    }
  }

  // Fallback to request socket IP
  return request.socket?.remoteAddress || "unknown";
}

/**
 * Check if a request is within the rate limit for the given route
 * Returns true if the request can proceed, false if rate limit is exceeded
 * If rate limit is exceeded, responds with 429 and returns false
 */
export async function checkRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  routePath: string,
  config: RateLimitConfig
): Promise<boolean> {
  const clientKey = getClientKey(request);
  const now = Date.now();

  // Get or create the route's client tracking map
  if (!store.has(routePath)) {
    store.set(routePath, new Map());
  }
  const clients = store.get(routePath)!;

  // Get or create the entry for this client
  let entry = clients.get(clientKey);

  if (!entry) {
    // First request from this client in this time window
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    clients.set(clientKey, entry);
    return true;
  }

  if (now >= entry.resetAt) {
    // Time window has expired, reset the counter
    entry.count = 1;
    entry.resetAt = now + config.windowMs;
    return true;
  }

  // Check if we've exceeded the limit
  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000); // Seconds until reset
    reply.header("Retry-After", retryAfter);
    reply.status(429).send({
      error: "Too many requests",
      message: `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${Math.round(config.windowMs / 1000)} seconds.`,
      retryAfter,
    });
    return false;
  }

  // Within limit, increment counter
  entry.count++;
  return true;
}

/**
 * Get current rate limit stats (useful for debugging)
 */
export function getRateLimitStats(routePath?: string): Record<string, Record<string, RateLimitEntry>> {
  const stats: Record<string, Record<string, RateLimitEntry>> = {};

  if (routePath) {
    const clients = store.get(routePath);
    if (clients) {
      stats[routePath] = Object.fromEntries(clients);
    }
  } else {
    for (const [path, clients] of store.entries()) {
      stats[path] = Object.fromEntries(clients);
    }
  }

  return stats;
}

/**
 * Clear all rate limit data (useful for testing)
 */
export function clearRateLimitStore(): void {
  store.clear();
}

/**
 * Create a Fastify route option for rate limiting
 * Can be attached to route schema to apply rate limiting
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply, routePath: string) => {
    const canProceed = await checkRateLimit(request, reply, routePath, config);
    return canProceed;
  };
}
