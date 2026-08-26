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

/**
 * Create a test user via Better Auth sign-up with optional role.
 * Returns the Better Auth token which works with all authenticated endpoints.
 */
export async function signUpTestUser(role: string = "garcom"): Promise<TestUser> {
  const id = crypto.randomUUID();
  const email = `testuser+${id}@example.com`;
  const password = "TestPassword123!";
  const name = "Test User";

  // Sign up via Better Auth with optional role
  const signUpRes = await api("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
  });

  if (!signUpRes.ok) {
    const body = await signUpRes.text();
    throw new Error(`Failed to sign up test user (${signUpRes.status}): ${body}`);
  }

  const signUpData = await signUpRes.json() as any;

  // Better Auth returns { token, user }
  const token = signUpData.token;
  const user = signUpData.user;

  if (!token) {
    throw new Error(`Failed to extract token from sign-up response: ${JSON.stringify(signUpData)}`);
  }

  const testUser: TestUser = {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || role,
    },
  };

  // Auto-register cleanup so the test file doesn't need to
  afterAll(async () => {
    await deleteTestUser(testUser.user.id, token);
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
 * Delete a test user via Better Auth delete-user endpoint, or gracefully skip
 * cleanup if the endpoint is unavailable or the token is invalid.
 */
export async function deleteTestUser(userId: string, token?: string): Promise<void> {
  // For now, skip cleanup. Test database is ephemeral anyway.
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
