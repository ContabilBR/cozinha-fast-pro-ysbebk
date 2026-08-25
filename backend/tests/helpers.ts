import { afterAll } from "bun:test";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3001";

/**
 * Strip Content-Type: application/json when there's no body.
 */
function sanitizeOptions(options?: RequestInit): RequestInit | undefined {
  if (!options?.headers || options.body) return options;
  const headers = new Headers(options.headers);
  if (headers.get("content-type")?.includes("application/json")) {
    headers.delete("content-type");
  }
  const entries = [...headers.entries()];
  return {
    ...options,
    headers: entries.length > 0 ? Object.fromEntries(entries) : undefined,
  };
}

/**
 * Make a request to the API under test.
 */
export async function api(
  path: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, sanitizeOptions(options));
}

/**
 * Make an authenticated request to the API under test.
 */
export async function authenticatedApi(
  path: string,
  token: string,
  options?: RequestInit
): Promise<Response> {
  const sanitized = sanitizeOptions(options);
  return fetch(`${BASE_URL}${path}`, {
    ...sanitized,
    headers: {
      ...sanitized?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export interface TestUser {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

// The seeded admin usuario (backend/src/db/seed.ts), scoped to the fixed
// test restaurante (00000000-0000-0000-0000-000000000001). Used only to
// bootstrap throwaway test usuarios via the real POST /api/usuarios flow —
// never returned to test files directly.
const SEED_ADMIN_EMAIL = "admin@cozinhafast.com";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "change-me-on-first-login";

let cachedSeedAdminToken: string | null = null;

async function getSeedAdminToken(): Promise<string> {
  if (cachedSeedAdminToken) return cachedSeedAdminToken;

  const res = await api("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: SEED_ADMIN_EMAIL, senha: SEED_ADMIN_PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to log in as seed admin (${res.status}): ${body}`);
  }

  const data = await res.json() as any;
  if (!data.token) {
    throw new Error(`Seed admin login response missing token: ${JSON.stringify(data)}`);
  }

  cachedSeedAdminToken = data.token;
  return cachedSeedAdminToken as string;
}

/**
 * Create a test usuario through the real production flow (POST /api/usuarios,
 * authenticated as the seeded admin — exactly how an admin adds a team member
 * in the actual app) and log in as them via POST /api/login (the same
 * endpoint the app itself uses). Returns the real usuarios_session bearer
 * token, so it works against every endpoint — including the WebSocket auth
 * in realtime.ts, which validates usuarios_session tokens.
 *
 * role defaults to "garcom"; pass "administrador" for admin-privileged test
 * users. Valid roles: administrador, gerente, garcom, cozinheiro.
 */
export async function signUpTestUser(role: string = "garcom"): Promise<TestUser> {
  const adminToken = await getSeedAdminToken();

  const id = crypto.randomUUID();
  const email = `testuser+${id}@example.com`;
  const senha = "TestPassword123!";

  const createRes = await authenticatedApi("/api/usuarios", adminToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: "Test User", email, senha, role }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Failed to create test usuario (${createRes.status}): ${body}`);
  }

  const created = await createRes.json() as any;

  const loginRes = await api("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });

  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`Failed to log in as test usuario (${loginRes.status}): ${body}`);
  }

  const loginData = await loginRes.json() as any;
  if (!loginData.token) {
    throw new Error(`Login response missing token: ${JSON.stringify(loginData)}`);
  }

  const testUser: TestUser = {
    token: loginData.token,
    user: {
      id: created.id,
      name: created.nome,
      email: created.email,
      role: created.role,
    },
  };

  // Auto-register cleanup so the test file doesn't need to
  afterAll(async () => {
    await deleteTestUser(testUser.user.id);
  });

  return testUser;
}

/**
 * Assert response status and include response body in error on mismatch.
 * Use instead of expect(res.status).toBe(x) for better error messages.
 */
export async function expectStatus(res: Response, ...expected: number[]): Promise<void> {
  if (!expected.includes(res.status)) {
    let body = "(unable to read body)";
    try {
      if (typeof res.clone === "function") {
        body = await res.clone().text();
      } else if (typeof res.text === "function") {
        body = await res.text();
      }
    } catch (e) {
      // body stays as "(unable to read body)"
    }
    if (body.length > 500) body = body.slice(0, 500) + "...";
    let path = "(unknown path)";
    try {
      if (res.url) {
        const url = new URL(res.url);
        path = url.pathname + url.search;
      }
    } catch (e) {
      // path stays as "(unknown path)"
    }
    console.error(`${path} — Expected ${expected.join("|")}, got ${res.status} — ${body}`);
    throw ``;
  }
}

/**
 * Delete a test usuario (cleanup), authenticated as the seeded admin via the
 * real DELETE /api/usuarios/:id endpoint.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const adminToken = await getSeedAdminToken();
  await authenticatedApi(`/api/usuarios/${userId}`, adminToken, {
    method: "DELETE",
  });
}

/**
 * Create a dummy file for multipart upload testing.
 * Returns a File object that can be appended to FormData.
 */
export function createTestFile(filename = "test.txt", content = "test file content", type = "text/plain"): File {
  return new File([content], filename, { type });
}

const WS_URL = BASE_URL.replace(/^http/, "ws");

/**
 * Connect to a WebSocket endpoint. Resolves when the connection is open.
 */
export async function connectWebSocket(path: string): Promise<WebSocket> {
  const url = new URL(path, WS_URL);
  const ws = new WebSocket(url.toString());
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error(`WebSocket connection failed: ${url}`));
    setTimeout(() => { ws.close(); reject(new Error("WebSocket connection timeout")); }, 5000);
  });
}

/**
 * Connect to an authenticated WebSocket endpoint.
 * Sends the token as the first message and waits for the authentication response.
 */
export async function connectAuthenticatedWebSocket(path: string, token: string): Promise<WebSocket> {
  const ws = await connectWebSocket(path);
  ws.send(JSON.stringify({ token }));
  const response = await waitForMessage(ws);
  const data = JSON.parse(response);
  if (data.error) {
    ws.close();
    throw new Error(`WebSocket auth failed: ${data.error}`);
  }
  return ws;
}

/**
 * Wait for the next message on a WebSocket.
 */
export function waitForMessage(ws: WebSocket, timeout = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    ws.onmessage = (event) => resolve(String(event.data));
    setTimeout(() => reject(new Error("WebSocket message timeout")), timeout);
  });
}
