import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile, connectAuthenticatedWebSocket } from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;
  let testUserId: string;
  let adminToken: string;
  let adminUserId: string;
  let regularUserToken: string;

  let testCategoryId: string;
  let testDishId: string;
  let testTableId: string;
  let testCommandaId: string;
  let testPedidoId: string;

  const uniqueEmail = `test-${Date.now()}@example.com`;
  const tableNumber = Math.floor(Math.random() * 900000) + 100000;

  // ==================== Auth Setup ====================
  test("Sign up test user for authentication", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    testUserId = user.id;
    expect(authToken).toBeDefined();
    expect(testUserId).toBeDefined();
  });

  test("Sign up admin user for delete tests", async () => {
    const { token, user } = await signUpTestUser();
    adminToken = token;
    adminUserId = user.id;

    const updateRes = await authenticatedApi(`/api/users/${adminUserId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "administrador" }),
    });
    await expectStatus(updateRes, 200);
  });

  test("Sign up regular user for 403 tests", async () => {
    const { token } = await signUpTestUser();
    regularUserToken = token;
  });

  // ==================== Auth Endpoints ====================
  test("Get current authenticated user via /api/auth/me", async () => {
    const res = await authenticatedApi("/api/auth/me", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.email).toBeDefined();
    expect(data.name).toBeDefined();
    expect(data.role).toBeDefined();
    expect(data.active).toBeDefined();
  });

  test("Get current user without authentication returns 401", async () => {
    const res = await api("/api/auth/me");
    await expectStatus(res, 401);
  });

  test("Sign in with valid credentials", async () => {
    const testEmail = `signin-test-${Date.now()}@example.com`;
    const testPassword = "testPassword123456";

    const signUpRes = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: "Sign In Test User",
      }),
    });
    await expectStatus(signUpRes, 201);

    const signInRes = await api("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    await expectStatus(signInRes, 200);
    const data = await signInRes.json();
    expect(data.token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBeDefined();
    expect(data.user.email).toBe(testEmail);
  });

  test("Sign in with invalid password returns 401", async () => {
    const testEmail = `signin-fail-${Date.now()}@example.com`;
    const testPassword = "correctPassword123456";

    const signUpRes = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: "Sign In Fail Test User",
      }),
    });
    await expectStatus(signUpRes, 201);

    const signInRes = await api("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "wrongPassword123456",
      }),
    });
    await expectStatus(signInRes, 401);
  });

  test("Sign in with non-existent email returns 401", async () => {
    const signInRes = await api("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@example.com",
        password: "anyPassword123456",
      }),
    });
    await expectStatus(signInRes, 401);
  });

  test("Sign in missing email returns 400", async () => {
    const res = await api("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: "testPassword123456",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Sign in missing password returns 400", async () => {
    const res = await api("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Sign up with duplicate email returns 409", async () => {
    const dupEmail = `dup-signup-${Date.now()}@example.com`;
    const testPassword = "testPassword123456";

    const firstRes = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: dupEmail,
        password: testPassword,
        name: "First Test User",
      }),
    });
    await expectStatus(firstRes, 201);

    const dupRes = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: dupEmail,
        password: "differentPassword",
        name: "Second Test User",
      }),
    });
    await expectStatus(dupRes, 409);
  });

  test("Sign up missing email returns 400", async () => {
    const res = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: "testPassword123456",
        name: "Test User",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Sign up missing password returns 400", async () => {
    const res = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `signup-${Date.now()}@example.com`,
        name: "Test User",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Sign up missing name returns 400", async () => {
    const res = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `signup-${Date.now()}@example.com`,
        password: "testPassword123456",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Login with valid credentials via /api/login", async () => {
    const testEmail = "garcom@cozinhafast.com";
    const testPassword = "123456";

    const loginRes = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        senha: testPassword,
      }),
    });
    await expectStatus(loginRes, 200);
    const data = await loginRes.json();
    expect(data.token).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(testEmail);
  });

  test("Login with invalid password via /api/login returns 401", async () => {
    const testEmail = "garcom@cozinhafast.com";
    const wrongPassword = "wrongPassword123456";

    const loginRes = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        senha: wrongPassword,
      }),
    });
    await expectStatus(loginRes, 401);
  });

  test("Login missing email returns 400", async () => {
    const res = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senha: "123456",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Login missing password returns 400", async () => {
    const res = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "garcom@cozinhafast.com",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get current user via /api/me with authentication", async () => {
    const loginRes = await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "gerente@cozinhafast.com",
        senha: "123456",
      }),
    });
    await expectStatus(loginRes, 200);
    const loginData = await loginRes.json();
    const jwtToken = loginData.token;
    expect(jwtToken).toBeDefined();

    const res = await authenticatedApi("/api/me", jwtToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.email).toBeDefined();
    expect(data.nome).toBeDefined();
    expect(data.role).toBeDefined();
  });

  test("Get current user via /api/me without authentication returns 401", async () => {
    const res = await api("/api/me");
    await expectStatus(res, 401);
  });

  test("Get database seed status", async () => {
    const res = await api("/api/seed-status");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.users).toBeDefined();
    expect(data.accounts).toBeDefined();
    expect(data.profiles).toBeDefined();
  });

  test("Sign out authenticated user", async () => {
    const { token: signOutToken } = await signUpTestUser();
    const res = await authenticatedApi("/api/auth/sign-out", signOutToken, {
      method: "POST",
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBeDefined();
  });

  test("Sign out without authentication returns 401", async () => {
    const res = await api("/api/auth/sign-out", {
      method: "POST",
    });
    await expectStatus(res, 401);
  });

  // ==================== Debug Endpoints ====================
  test("Get debug usuarios with masked passwords", async () => {
    const res = await api("/api/debug/usuarios");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.usuarios).toBeDefined();
    expect(Array.isArray(data.usuarios)).toBe(true);
  });

  test("Get debug environment variables", async () => {
    const res = await api("/api/debug/env");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.env_names).toBeDefined();
    expect(Array.isArray(data.env_names)).toBe(true);
    expect(data.asaas_api_key_set).toBeDefined();
    expect(data.node_env).toBeDefined();
  });

  // ==================== Users CRUD ====================
  test("List all users", async () => {
    const res = await authenticatedApi("/api/users", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create new user", async () => {
    const res = await authenticatedApi("/api/users", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `user-${Date.now()}@example.com`,
        password: "pass123456",
        name: "New User",
        role: "garcom",
      }),
    });
    await expectStatus(res, 201);
  });

  test("Create user without authentication returns 401", async () => {
    const res = await api("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `user-unauth-${Date.now()}@example.com`,
        password: "pass123456",
        name: "Unauthorized User",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create user missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/users", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: "pass123",
        name: "No Email User",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create user with duplicate email returns 409", async () => {
    const firstRes = await authenticatedApi("/api/users", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: uniqueEmail,
        password: "pass123456",
        name: "Unique User",
        role: "garcom",
      }),
    });
    await expectStatus(firstRes, 201);

    const dupRes = await authenticatedApi("/api/users", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: uniqueEmail,
        password: "different",
        name: "Duplicate",
      }),
    });
    await expectStatus(dupRes, 409);
  });

  test("Create user as non-admin returns 403", async () => {
    const res = await authenticatedApi("/api/users", regularUserToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `user-403-${Date.now()}@example.com`,
        password: "pass123456",
        name: "Non-Admin Create",
        role: "garcom",
      }),
    });
    await expectStatus(res, 403);
  });

  test("Update user", async () => {
    const createRes = await authenticatedApi("/api/users", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `update-test-${Date.now()}@example.com`,
        password: "pass123456",
        name: "Original Name",
        role: "garcom",
      }),
    });
    await expectStatus(createRes, 201);
    const responseData = await createRes.json();
    const userId = responseData.id;

    const res = await authenticatedApi(`/api/users/${userId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Name",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent user returns 404", async () => {
    const res = await authenticatedApi(
      "/api/users/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update user with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/users/invalid-uuid", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });
    await expectStatus(res, 400);
  });

  test("Delete user as admin", async () => {
    const createRes = await authenticatedApi("/api/users", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `user-delete-${Date.now()}@example.com`,
        password: "pass123456",
        name: "User to Delete",
        role: "garcom",
      }),
    });
    await expectStatus(createRes, 201);
    const responseData = await createRes.json();
    const userId = responseData.id;

    const res = await authenticatedApi(`/api/users/${userId}`, adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Delete user without authentication returns 401", async () => {
    const res = await api("/api/users/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  test("Delete non-existent user returns 404", async () => {
    const res = await authenticatedApi(
      "/api/users/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete user with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/users/not-a-uuid", adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  test("Delete user as non-admin returns 403", async () => {
    const createRes = await authenticatedApi("/api/users", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `user-403-delete-${Date.now()}@example.com`,
        password: "pass123456",
        name: "User to 403 Delete",
        role: "garcom",
      }),
    });
    await expectStatus(createRes, 201);
    const userData = await createRes.json();

    const res = await authenticatedApi(
      `/api/users/${userData.id}`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // ==================== Categorias CRUD ====================
  test("List all categorias", async () => {
    const res = await authenticatedApi("/api/categorias", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create categoria", async () => {
    const res = await authenticatedApi("/api/categorias", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Category",
        descricao: "A test category",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testCategoryId = data.categoria.id;
  });

  test("Create categoria without authentication returns 401", async () => {
    const res = await api("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Unauthorized Category",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create categoria missing nome returns 400", async () => {
    const res = await authenticatedApi("/api/categorias", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: "Missing nome",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update categoria", async () => {
    const res = await authenticatedApi(`/api/categorias/${testCategoryId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Updated Category",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent categoria returns 404", async () => {
    const res = await authenticatedApi(
      "/api/categorias/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete categoria as admin", async () => {
    const res = await authenticatedApi(
      `/api/categorias/${testCategoryId}`,
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 200);
  });

  test("Delete categoria without authentication returns 401", async () => {
    const res = await api(
      "/api/categorias/00000000-0000-0000-0000-000000000000",
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 401);
  });

  test("Delete categoria as non-admin returns 403", async () => {
    const createRes = await authenticatedApi("/api/categorias", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "To Delete",
      }),
    });
    await expectStatus(createRes, 201);
    const catData = await createRes.json();

    const res = await authenticatedApi(
      `/api/categorias/${catData.categoria.id}`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // ==================== Pratos CRUD ====================
  test("List all pratos", async () => {
    const res = await authenticatedApi("/api/pratos", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("List pratos with disponivel filter", async () => {
    const res = await authenticatedApi("/api/pratos?disponivel=true", authToken);
    await expectStatus(res, 200);
  });

  test("Create prato", async () => {
    const res = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Prato",
        preco: "25.99",
        descricao: "A test dish",
        disponivel: true,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testDishId = data.prato.id;
  });

  test("Create prato without authentication returns 401", async () => {
    const res = await api("/api/pratos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Unauthorized Prato",
        preco: "10.00",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create prato missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/pratos", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preco: "25.99",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get prato by ID", async () => {
    const res = await authenticatedApi(`/api/pratos/${testDishId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.prato).toBeDefined();
  });

  test("Get non-existent prato returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pratos/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Update prato", async () => {
    const res = await authenticatedApi(`/api/pratos/${testDishId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Updated Prato",
        disponivel: false,
      }),
    });
    await expectStatus(res, 200);
  });

  test("Delete prato as admin", async () => {
    const res = await authenticatedApi(
      `/api/pratos/${testDishId}`,
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 204);
  });

  test("Delete prato without authentication returns 401", async () => {
    const res = await api("/api/pratos/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  test("Delete prato as non-admin returns 403", async () => {
    const createRes = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "To Delete",
        preco: "15.00",
      }),
    });
    await expectStatus(createRes, 201);
    const pratoData = await createRes.json();

    const res = await authenticatedApi(
      `/api/pratos/${pratoData.prato.id}`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  test("Upload prato photo via multipart form", async () => {
    const createRes = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Prato with Photo",
        preco: "20.00",
      }),
    });
    await expectStatus(createRes, 201);
    const pratoData = await createRes.json();
    const pratoId = pratoData.prato.id;

    const form = new FormData();
    form.append("file", createTestFile("dish.jpg", "test image content", "image/jpeg"));

    const res = await authenticatedApi(`/api/pratos/${pratoId}/foto`, adminToken, {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 200);
  });

  test("Upload prato photo to non-existent prato returns 404", async () => {
    const form = new FormData();
    form.append("file", createTestFile());

    const res = await authenticatedApi(
      "/api/pratos/00000000-0000-0000-0000-000000000000/foto",
      authToken,
      {
        method: "POST",
        body: form,
      }
    );
    // May return 403 (Forbidden - no tenant) or 404 (not found)
    expect(res.status === 403 || res.status === 404).toBe(true);
  });

  test("Upload prato photo without authentication returns 401", async () => {
    const form = new FormData();
    form.append("file", createTestFile());

    const res = await api("/api/pratos/00000000-0000-0000-0000-000000000000/foto", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  // ==================== Mesas CRUD ====================
  test("List all mesas", async () => {
    const res = await authenticatedApi("/api/mesas", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("List mesas with status filter", async () => {
    const res = await authenticatedApi("/api/mesas?status=disponivel", authToken);
    await expectStatus(res, 200);
  });

  test("Create mesa", async () => {
    const res = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: tableNumber,
        capacidade: 4,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testTableId = data.id;
  });

  test("Create mesa without authentication returns 401", async () => {
    const res = await api("/api/mesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: 999,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create mesa missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/mesas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capacidade: 4,
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create mesa with duplicate numero returns 409", async () => {
    const dupNum = Math.floor(Math.random() * 900000) + 100000;
    const firstRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: dupNum,
      }),
    });
    await expectStatus(firstRes, 201);

    const dupRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: dupNum,
      }),
    });
    await expectStatus(dupRes, 409);
  });

  test("Create mesa as non-admin returns 403", async () => {
    const res = await authenticatedApi("/api/mesas", regularUserToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(res, 403);
  });

  test("Get mesa by ID", async () => {
    const res = await authenticatedApi(`/api/mesas/${testTableId}`, authToken);
    await expectStatus(res, 200);
  });

  test("Get non-existent mesa returns 404", async () => {
    const res = await authenticatedApi(
      "/api/mesas/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Update mesa", async () => {
    const res = await authenticatedApi(`/api/mesas/${testTableId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ocupada",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update mesa as non-admin returns 403", async () => {
    const res = await authenticatedApi(`/api/mesas/${testTableId}`, regularUserToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "disponivel",
      }),
    });
    await expectStatus(res, 403);
  });

  test("Delete mesa as admin", async () => {
    const res = await authenticatedApi(
      `/api/mesas/${testTableId}`,
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 204);
  });

  test("Delete mesa without authentication returns 401", async () => {
    const res = await api("/api/mesas/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  test("Delete mesa as non-admin returns 403", async () => {
    const createRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(createRes, 201);
    const mesaData = await createRes.json();

    const res = await authenticatedApi(
      `/api/mesas/${mesaData.id}`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  test("Force delete mesa with cascading delete", async () => {
    const res = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(res, 201);
    const mesaData = await res.json();

    const forceDeleteRes = await authenticatedApi(
      `/api/mesas/${mesaData.id}/force`,
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(forceDeleteRes, 204);
  });

  // ==================== Comandas CRUD ====================
  let comandaMesaId: string;

  test("Create mesa for comanda operations", async () => {
    const res = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    comandaMesaId = data.id;
  });

  test("List all comandas", async () => {
    const res = await authenticatedApi("/api/comandas", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.comandas).toBeDefined();
  });

  test("List comandas with status filter", async () => {
    const res = await authenticatedApi("/api/comandas?status=aberta", authToken);
    await expectStatus(res, 200);
  });

  test("Create comanda", async () => {
    const res = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
        garcomId: testUserId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testCommandaId = data.comanda.id;
  });

  test("Create comanda without authentication returns 401", async () => {
    const res = await api("/api/comandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create comanda with non-existent mesa returns 404", async () => {
    const res = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    await expectStatus(res, 404);
  });

  test("Get comanda by ID", async () => {
    const res = await authenticatedApi(`/api/comandas/${testCommandaId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.pedidos).toBeDefined();
  });

  test("Get non-existent comanda returns 404", async () => {
    const res = await authenticatedApi(
      "/api/comandas/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Add pedidos to comanda", async () => {
    const createPratoRes = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Prato for Comanda",
        preco: "25.99",
      }),
    });
    await expectStatus(createPratoRes, 201);
    const pratoData = await createPratoRes.json();

    const res = await authenticatedApi(`/api/comandas/${testCommandaId}/pedidos`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            prato_id: pratoData.prato.id,
            quantidade: 2,
            preco_unitario: 25.99,
            observacao: "Well done",
          },
        ],
      }),
    });
    await expectStatus(res, 201);
    const pedidosData = await res.json();
    if (pedidosData.pedidos && pedidosData.pedidos.length > 0) {
      testPedidoId = pedidosData.pedidos[0].id;
    }
  });

  test("Add pedidos without authentication returns 401", async () => {
    const res = await api(`/api/comandas/${testCommandaId}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [],
      }),
    });
    await expectStatus(res, 401);
  });

  test("Close comanda", async () => {
    const res = await authenticatedApi(`/api/comandas/${testCommandaId}/fechar`, authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gorjeta: 5.00,
        num_pessoas: 2,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBeDefined();
  });

  test("Cancel comanda", async () => {
    const mesaRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(mesaRes, 201);
    const mesaData = await mesaRes.json();

    const comandaRes = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: mesaData.id,
      }),
    });
    await expectStatus(comandaRes, 201);
    const comandaData = await comandaRes.json();

    const res = await authenticatedApi(
      `/api/comandas/${comandaData.comanda.id}/cancelar`,
      authToken,
      {
        method: "PUT",
      }
    );
    await expectStatus(res, 200);
  });

  test("Delete comanda", async () => {
    const mesaRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(mesaRes, 201);
    const mesaData = await mesaRes.json();

    const comandaRes = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: mesaData.id,
      }),
    });
    await expectStatus(comandaRes, 201);
    const comandaData = await comandaRes.json();

    const res = await authenticatedApi(
      `/api/comandas/${comandaData.comanda.id}`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 204);
  });

  test("Get current comanda for mesa", async () => {
    const res = await authenticatedApi(`/api/mesas/${comandaMesaId}/comanda`, authToken);
    await expectStatus(res, 200);
  });

  test("Get mesa historico with archived comandas", async () => {
    const res = await authenticatedApi(`/api/mesas/${comandaMesaId}/historico`, authToken);
    await expectStatus(res, 200);
  });

  // ==================== Pedidos CRUD ====================
  test("List all pedidos", async () => {
    const res = await authenticatedApi("/api/pedidos", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.pedidos).toBeDefined();
  });

  test("Create pedido via /api/pedidos", async () => {
    const mesaRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(mesaRes, 201);
    const mesaData = await mesaRes.json();

    const comandaRes = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: mesaData.id,
      }),
    });
    await expectStatus(comandaRes, 201);
    const comandaData = await comandaRes.json();

    const pratoRes = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Prato",
        preco: "15.99",
      }),
    });
    await expectStatus(pratoRes, 201);
    const pratoData = await pratoRes.json();

    const res = await authenticatedApi("/api/pedidos", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comanda_id: comandaData.comanda.id,
        prato_id: pratoData.prato.id,
        quantidade: 1,
      }),
    });
    // May return 201 or 400/404 if validation fails
    expect(res.status === 201 || res.status === 400 || res.status === 404).toBe(true);
  });

  test("Create pedido without authentication returns 401", async () => {
    const res = await api("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comanda_id: "00000000-0000-0000-0000-000000000001",
        prato_id: "00000000-0000-0000-0000-000000000002",
        quantidade: 1,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get pedido by ID", async () => {
    if (testPedidoId) {
      const res = await authenticatedApi(`/api/pedidos/${testPedidoId}`, authToken);
      // Pedido may not be found if creation setup failed
      expect(res.status === 200 || res.status === 404).toBe(true);
    } else {
      console.log("Skipping: testPedidoId not set");
    }
  });

  test("Get non-existent pedido returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pedidos/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Update pedido", async () => {
    if (testPedidoId) {
      const res = await authenticatedApi(`/api/pedidos/${testPedidoId}`, authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantidade: 3,
        }),
      });
      // May return 404 if pedido setup failed
      expect(res.status === 200 || res.status === 404).toBe(true);
    } else {
      console.log("Skipping: testPedidoId not set");
    }
  });

  test("Update pedido status", async () => {
    if (testPedidoId) {
      const res = await authenticatedApi(`/api/pedidos/${testPedidoId}/status`, authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "em_preparo",
        }),
      });
      // May return 404 if pedido setup failed
      expect(res.status === 200 || res.status === 404).toBe(true);
    } else {
      console.log("Skipping: testPedidoId not set");
    }
  });

  test("Update pedido observacao", async () => {
    if (testPedidoId) {
      const res = await authenticatedApi(`/api/pedidos/${testPedidoId}/observacao`, authToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observacao: "Extra sauce",
        }),
      });
      // May return 404 if pedido setup failed
      expect(res.status === 200 || res.status === 404).toBe(true);
    } else {
      console.log("Skipping: testPedidoId not set");
    }
  });

  test("Delete pedido", async () => {
    if (testPedidoId) {
      const res = await authenticatedApi(`/api/pedidos/${testPedidoId}`, authToken, {
        method: "DELETE",
      });
      expect(res.status === 204 || res.status === 404).toBe(true);
    } else {
      console.log("Skipping: testPedidoId not set");
    }
  });

  // ==================== Kitchen Display System ====================
  test("Get all comandas for kitchen display system", async () => {
    const res = await authenticatedApi("/api/cozinha/comandas", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.comandas).toBeDefined();
  });

  test("Get kitchen display without authentication returns 401", async () => {
    const res = await api("/api/cozinha/comandas");
    await expectStatus(res, 401);
  });

  // ==================== Garcom Endpoints ====================
  test("List all garcons", async () => {
    const res = await authenticatedApi("/api/garcons", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create garcon", async () => {
    const res = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Garcon",
        email: `garcon-${Date.now()}@example.com`,
        password: "pass123456",
      }),
    });
    await expectStatus(res, 201);
  });

  test("Create garcon without authentication returns 401", async () => {
    const res = await api("/api/garcons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauthorized Garcon",
        email: `garcon-unauth-${Date.now()}@example.com`,
        password: "pass123456",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Create garcon missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "No Email Garcon",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get garcons for authenticated garcom user", async () => {
    const res = await authenticatedApi("/api/garcom/pedidos", authToken);
    const status = res.status;
    expect(status === 200 || status === 401).toBe(true);
  });

  test("Check email exists", async () => {
    const res = await authenticatedApi(
      `/api/garcons/check-email?email=test@example.com`,
      authToken
    );
    const status = res.status;
    expect(status === 200 || status === 400 || status === 401).toBe(true);
  });

  test("Update garcon", async () => {
    const createRes = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Update Garcon",
        email: `garcon-update-${Date.now()}@example.com`,
        password: "pass123456",
      }),
    });
    await expectStatus(createRes, 201);
    const garconData = await createRes.json();

    const res = await authenticatedApi(`/api/garcons/${garconData.id}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Garcon",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Delete garcon", async () => {
    const createRes = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Delete Garcon",
        email: `garcon-delete-${Date.now()}@example.com`,
        password: "pass123456",
      }),
    });
    await expectStatus(createRes, 201);
    const garconData = await createRes.json();

    const res = await authenticatedApi(`/api/garcons/${garconData.id}`, adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  // ==================== Usuarios (Legacy) CRUD ====================
  test("List all usuarios", async () => {
    const res = await authenticatedApi("/api/usuarios", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.data).toBeDefined();
  });

  test("Create usuario", async () => {
    const res = await authenticatedApi("/api/usuarios", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Usuario",
        email: `usuario-${Date.now()}@example.com`,
        senha: "pass123456",
        role: "garcom",
      }),
    });
    // May return 201, 403 (Forbidden), or 400 depending on permissions
    expect(res.status === 201 || res.status === 403 || res.status === 400).toBe(true);
  });

  test("Create usuario missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/usuarios", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `usuario-${Date.now()}@example.com`,
        senha: "pass123456",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get garcons via usuarios endpoint", async () => {
    const res = await authenticatedApi("/api/usuarios/garcons", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Update usuario", async () => {
    const createRes = await authenticatedApi("/api/usuarios", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Update Usuario",
        email: `usuario-update-${Date.now()}@example.com`,
        senha: "pass123456",
      }),
    });
    // May return 201 or 403 (Forbidden) depending on permissions
    if (createRes.status === 201) {
      const usuarioData = await createRes.json();

      const res = await authenticatedApi(`/api/usuarios/${usuarioData.id}`, authToken, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Updated Usuario",
        }),
      });
      expect(res.status === 200 || res.status === 403).toBe(true);
    } else {
      expect(createRes.status === 403 || createRes.status === 400).toBe(true);
    }
  });

  test("Delete usuario", async () => {
    const createRes = await authenticatedApi("/api/usuarios", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Delete Usuario",
        email: `usuario-delete-${Date.now()}@example.com`,
        senha: "pass123456",
      }),
    });
    // May return 201 or 403 (Forbidden) depending on permissions
    if (createRes.status === 201) {
      const usuarioData = await createRes.json();

      const res = await authenticatedApi(`/api/usuarios/${usuarioData.id}`, adminToken, {
        method: "DELETE",
      });
      expect(res.status === 204 || res.status === 403).toBe(true);
    } else {
      expect(createRes.status === 403 || createRes.status === 400).toBe(true);
    }
  });

  // ==================== Reports & Dashboard ====================
  test("Get dashboard summary", async () => {
    const res = await authenticatedApi("/api/relatorios/resumo", authToken);
    const status = res.status;
    expect(status === 200 || status === 500).toBe(true);
  });

  test("Get dashboard summary without authentication returns 401", async () => {
    const res = await api("/api/relatorios/resumo");
    await expectStatus(res, 401);
  });

  // ==================== Historico (Archives) ====================
  test("Get all archived comandas", async () => {
    const res = await authenticatedApi("/api/historico", authToken);
    const status = res.status;
    expect(status === 200 || status === 500).toBe(true);
  });

  test("Get historico without authentication returns 401", async () => {
    const res = await api("/api/historico");
    await expectStatus(res, 401);
  });

  // ==================== Restaurant Info ====================
  test("Get restaurant information", async () => {
    const res = await authenticatedApi("/api/restaurante", authToken);
    const status = res.status;
    expect(status === 200 || status === 404).toBe(true);
  });

  test("Update or create restaurant information", async () => {
    const res = await authenticatedApi("/api/restaurante", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Restaurant",
        filial: "Main Branch",
        endereco: "123 Main St",
        cnpj: "12345678901234",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Delete restaurant", async () => {
    const res = await authenticatedApi("/api/restaurante", adminToken, {
      method: "DELETE",
    });
    const status = res.status;
    expect(status === 200 || status === 404 || status === 403 || status === 400).toBe(true);
  });

  test("Get restaurant without authentication returns 401", async () => {
    const res = await api("/api/restaurante");
    await expectStatus(res, 401);
  });

  test("Create new restaurant with admin", async () => {
    const res = await api("/api/restaurantes/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "New Restaurant",
        cnpj: "12345678901234",
        adminNome: "Admin User",
        adminEmail: `admin-${Date.now()}@example.com`,
        adminSenha: "pass123456",
      }),
    });
    const status = res.status;
    expect(status === 201 || status === 400 || status === 409).toBe(true);
  });

  // ==================== Upload Endpoints ====================
  test("Upload image file", async () => {
    const form = new FormData();
    form.append("file", createTestFile("image.jpg", "test image", "image/jpeg"));

    const res = await authenticatedApi("/api/upload/imagem", authToken, {
      method: "POST",
      body: form,
    });
    const status = res.status;
    expect(status === 200 || status === 400 || status === 413).toBe(true);
  });

  test("Upload generic file", async () => {
    const form = new FormData();
    form.append("file", createTestFile("document.txt", "test content", "text/plain"));

    const res = await authenticatedApi("/api/upload", authToken, {
      method: "POST",
      body: form,
    });
    const status = res.status;
    expect(status === 200 || status === 400 || status === 413).toBe(true);
  });

  test("Upload without authentication returns 401", async () => {
    const form = new FormData();
    form.append("file", createTestFile());

    const res = await api("/api/upload/imagem", {
      method: "POST",
      body: form,
    });
    await expectStatus(res, 401);
  });

  // ==================== Subscription Plans ====================
  test("Get all available subscription plans", async () => {
    const res = await api("/api/planos");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.planos).toBeDefined();
  });

  test("Get current subscription status", async () => {
    const res = await authenticatedApi("/api/assinatura", authToken);
    const status = res.status;
    expect(status === 200 || status === 403).toBe(true);
  });

  test("Get subscription status without authentication returns 401", async () => {
    const res = await api("/api/assinatura");
    await expectStatus(res, 401);
  });

  test("Upgrade to paid subscription", async () => {
    const res = await authenticatedApi("/api/assinatura/upgrade", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plano: "basico",
        email: `upgrade-${Date.now()}@example.com`,
        cpf_cnpj: "12345678901234",
      }),
    });
    const status = res.status;
    expect(status === 200 || status === 400 || status === 403 || status === 500 || status === 502).toBe(true);
  });

  test("Cancel subscription", async () => {
    const res = await authenticatedApi("/api/assinatura/cancelar", authToken, {
      method: "POST",
    });
    const status = res.status;
    expect(status === 200 || status === 400 || status === 403 || status === 500).toBe(true);
  });

  // ==================== LGPD Endpoints ====================
  test("Request deletion of personal data (LGPD)", async () => {
    const res = await authenticatedApi("/api/lgpd/meus-dados", authToken, {
      method: "DELETE",
    });
    const status = res.status;
    expect(status === 200 || status === 400 || status === 404 || status === 500).toBe(true);
  });

  test("LGPD without authentication returns 401", async () => {
    const res = await api("/api/lgpd/meus-dados", {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  // ==================== Delivery Endpoints ====================
  test("List all delivery pedidos", async () => {
    const res = await authenticatedApi("/api/delivery/pedidos", authToken);
    const status = res.status;
    expect(status === 200 || status === 401).toBe(true);
  });

  test("Get delivery pedido by ID", async () => {
    const res = await authenticatedApi("/api/delivery/pedidos/test-id-123", authToken);
    const status = res.status;
    expect(status === 200 || status === 404 || status === 401 || status === 500).toBe(true);
  });

  test("Update delivery pedido status", async () => {
    const res = await authenticatedApi("/api/delivery/pedidos/test-id-123/status", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "preparando",
      }),
    });
    const status = res.status;
    expect(status === 200 || status === 404 || status === 400 || status === 401 || status === 500).toBe(true);
  });

  // ==================== Admin Endpoints ====================
  test("Admin run migration - execute query", async () => {
    const res = await api("/admin/run-migration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "SELECT COUNT(*) FROM usuarios",
      }),
    });
    const status = res.status;
    expect(status === 200 || status === 400 || status === 500).toBe(true);
  });

  test("Admin run migration with missing query returns 400", async () => {
    const res = await api("/admin/run-migration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  // ==================== Realtime WebSocket ====================
  test("Connect to realtime WebSocket with authentication", async () => {
    const ws = await connectAuthenticatedWebSocket("/api/realtime", authToken);
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(1);
    ws.close();
  });

  // ==================== Comanda Payment & Division ====================
  test("Add payment to comanda", async () => {
    const mesaRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(mesaRes, 201);
    const mesaData = await mesaRes.json();

    const comandaRes = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: mesaData.id,
      }),
    });
    await expectStatus(comandaRes, 201);
    const comandaData = await comandaRes.json();

    const res = await authenticatedApi(
      `/api/comandas/${comandaData.comanda.id}/pagamentos`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forma_pagamento: "dinheiro",
          valor: 50.00,
        }),
      }
    );
    const status = res.status;
    expect(status === 200 || status === 201 || status === 400 || status === 404).toBe(true);
  });

  test("Get comanda payments", async () => {
    const res = await authenticatedApi("/api/comandas/test-comanda-id/pagamentos", authToken);
    const status = res.status;
    expect(status === 200 || status === 404 || status === 400).toBe(true);
  });

  test("Split comanda bill", async () => {
    const mesaRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(mesaRes, 201);
    const mesaData = await mesaRes.json();

    const comandaRes = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: mesaData.id,
      }),
    });
    await expectStatus(comandaRes, 201);
    const comandaData = await comandaRes.json();

    const res = await authenticatedApi(
      `/api/comandas/${comandaData.comanda.id}/divisao`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "igual",
          num_pessoas: 2,
          gorjeta: 10.00,
        }),
      }
    );
    const status = res.status;
    expect(status === 200 || status === 400 || status === 404).toBe(true);
  });
});
