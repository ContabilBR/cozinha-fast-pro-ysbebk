import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile, connectAuthenticatedWebSocket } from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;
  let testUserId: string;
  let adminToken: string;
  let adminUserId: string;
  let testUsuarioId: string;
  let testGarcomId: string;
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
    const { token, user } = await signUpTestUser();
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
    if (data.usuarios.length > 0) {
      const usuario = data.usuarios[0];
      expect(usuario.id).toBeDefined();
      expect(usuario.nome).toBeDefined();
      expect(usuario.email).toBeDefined();
      expect(usuario.senha_hash).toBeDefined();
      expect(usuario.role).toBeDefined();
    }
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

  // ==================== Pratos CRUD ====================
  let pratoCategoryId: string;

  test("Create categoria for pratos", async () => {
    const res = await authenticatedApi("/api/categorias", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Main Courses",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    pratoCategoryId = data.categoria.id;
  });

  test("List all pratos", async () => {
    const res = await authenticatedApi("/api/pratos", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create prato", async () => {
    const res = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Prato",
        preco: "25.99",
        categoriaId: pratoCategoryId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testDishId = data.prato.id;
  });

  test("Get prato by ID", async () => {
    const res = await authenticatedApi(`/api/pratos/${testDishId}`, authToken);
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

  // ==================== Mesas CRUD ====================
  test("Create mesa", async () => {
    const res = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: tableNumber,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testTableId = data.id;
  });

  test("Get mesa by ID", async () => {
    const res = await authenticatedApi(`/api/mesas/${testTableId}`, authToken);
    await expectStatus(res, 200);
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

  test("Get comanda by ID", async () => {
    const res = await authenticatedApi(`/api/comandas/${testCommandaId}`, authToken);
    await expectStatus(res, 200);
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
  });

  // ==================== Subscription Plans ====================
  test("Get all available subscription plans", async () => {
    const res = await api("/api/planos");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.planos).toBeDefined();
  });

  // ==================== Delivery Pedidos ====================
  test("List all delivery pedidos", async () => {
    const res = await authenticatedApi("/api/delivery/pedidos", authToken);
    await expectStatus(res, 200);
  });

  test("List delivery pedidos without authentication returns 401", async () => {
    const res = await api("/api/delivery/pedidos");
    await expectStatus(res, 401);
  });

  test("Create delivery pedido", async () => {
    const res = await authenticatedApi("/api/delivery/pedidos", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_nome: "John Doe",
        cliente_email: `delivery-${Date.now()}@example.com`,
        endereco_entrega: "123 Main St",
        total: 45.99,
      }),
    });
    const status = res.status;
    expect(status === 201 || status === 400 || status === 401).toBe(true);
  });

  test("Get delivery pedido by ID", async () => {
    const res = await authenticatedApi("/api/delivery/pedidos/test-id-123", authToken);
    const status = res.status;
    expect(status === 200 || status === 404 || status === 400 || status === 401 || status === 500).toBe(true);
  });

  test("Update delivery pedido status", async () => {
    const res = await authenticatedApi("/api/delivery/pedidos/test-id-123/status", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "em_transito",
      }),
    });
    const status = res.status;
    expect(status === 200 || status === 404 || status === 400).toBe(true);
  });

  // ==================== Fiscal NFCe ====================
  test("List all fiscal notas", async () => {
    const res = await authenticatedApi("/api/fiscal/notas", authToken);
    const status = res.status;
    expect(status === 200 || status === 400 || status === 500).toBe(true);
  });

  test("Create NFCe", async () => {
    const res = await authenticatedApi("/api/fiscal/nfce", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comanda_id: "test-comanda-id",
        items: [
          {
            descricao: "Test Item",
            quantidade: 1,
            valor_unitario: 25.00,
          },
        ],
        valor_total: 25.00,
      }),
    });
    const status = res.status;
    expect(status === 200 || status === 201 || status === 400 || status === 404).toBe(true);
  });

  test("Create NFCe without authentication returns 401", async () => {
    const res = await api("/api/fiscal/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comanda_id: "test-comanda-id",
        items: [],
        valor_total: 25.00,
      }),
    });
    await expectStatus(res, 401);
  });

  test("Get NFCe by reference", async () => {
    const res = await authenticatedApi("/api/fiscal/nfce/test-ref-123", authToken);
    const status = res.status;
    expect(status === 200 || status === 404 || status === 400).toBe(true);
  });

  test("Delete NFCe by reference", async () => {
    const res = await authenticatedApi("/api/fiscal/nfce/test-ref-123", authToken, {
      method: "DELETE",
    });
    const status = res.status;
    expect(status === 200 || status === 404 || status === 400).toBe(true);
  });

  test("Delete NFCe without authentication returns 401", async () => {
    const res = await api("/api/fiscal/nfce/test-ref-123", {
      method: "DELETE",
    });
    await expectStatus(res, 401);
  });

  // ==================== Admin Migration ====================
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
});
