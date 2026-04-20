import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus, createTestFile } from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;
  let testUserId: string;
  let adminToken: string;
  let adminUserId: string;
  let testUsuarioId: string;
  let testGarcomId: string;
  let regularUserToken: string; // Non-admin user for 403 tests

  // Resource IDs for dependency chaining
  let testCategoryId: string;
  let testDishId: string;
  let testTableId: string;
  let testCommandaId: string;
  let testPedidoId: string;

  // Generate unique data to avoid conflicts
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

    // Update admin user role to 'administrador'
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
    // Keep as default role (garcom), don't set to admin
  });

  // ==================== Auth Endpoints ====================
  test("Get current authenticated user", async () => {
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
    // Create a test user for sign-in
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

    // Now sign in with valid credentials
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

    // Create a user
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

    // Try to sign in with wrong password
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

  test("Login with valid credentials via /api/login", async () => {
    // Use a seeded user from the database (custom /api/login works with usuarios table)
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
    // Use a seeded user but with wrong password
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

  test("Get current user via /api/me with authentication", async () => {
    // Login with a seeded user (gerente@cozinhafast.com with password 123456)
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

    // Now use the JWT token with /api/me
    const res = await authenticatedApi("/api/me", jwtToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.email).toBeDefined();
    expect(data.nome).toBeDefined(); // Custom endpoint returns 'nome' not 'name'
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
    // Create first user
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

    // Try to create with same email
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

  test("Update user", async () => {
    // Create a user to update
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

    // Update the user
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
    // Create a user for deletion
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

    // Delete it
    const res = await authenticatedApi(`/api/users/${userId}`, adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
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

  // ==================== Categorias CRUD ====================
  test("List all categorias", async () => {
    const res = await authenticatedApi("/api/categorias", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.categorias).toBeDefined();
    expect(Array.isArray(data.categorias)).toBe(true);
  });

  test("Create categoria", async () => {
    const res = await authenticatedApi("/api/categorias", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Appetizers",
        descricao: "Starters and appetizers",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testCategoryId = data.categoria.id;
  });

  test("Create categoria missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/categorias", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: "No name category",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update categoria", async () => {
    const res = await authenticatedApi(`/api/categorias/${testCategoryId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Updated Appetizers",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent categoria returns 404", async () => {
    const res = await authenticatedApi(
      "/api/categorias/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update categoria with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/categorias/invalid-uuid", adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Test" }),
    });
    await expectStatus(res, 400);
  });

  test("Delete categoria as admin", async () => {
    const res = await authenticatedApi(`/api/categorias/${testCategoryId}`, adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Delete non-existent categoria returns 404", async () => {
    const res = await authenticatedApi(
      "/api/categorias/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete categoria with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/categorias/bad-uuid", adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  test("Delete categoria as non-admin returns 403", async () => {
    // Create a categoria first
    const createRes = await authenticatedApi("/api/categorias", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Delete 403",
      }),
    });
    await expectStatus(createRes, 201);
    const data = await createRes.json();

    // Try to delete with regular user
    const res = await authenticatedApi(`/api/categorias/${data.categoria.id}`, regularUserToken, {
      method: "DELETE",
    });
    await expectStatus(res, 403);
  });

  // ==================== Pratos CRUD (depends on categoria) ====================
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
    expect(data.pratos).toBeDefined();
    expect(Array.isArray(data.pratos)).toBe(true);
  });

  test("Create prato", async () => {
    const res = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Grilled Salmon",
        preco: "25.99",
        descricao: "Fresh salmon with lemon",
        categoriaId: pratoCategoryId,
        disponivel: true,
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

  test("Get non-existent prato returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pratos/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Get prato with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/pratos/invalid-uuid", authToken);
    await expectStatus(res, 400);
  });

  test("Create prato missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/pratos", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Pasta",
        // missing required preco
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update prato", async () => {
    const res = await authenticatedApi(`/api/pratos/${testDishId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Grilled Salmon with Asparagus",
        preco: "27.99",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent prato returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pratos/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update prato with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/pratos/bad-uuid", adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Test" }),
    });
    await expectStatus(res, 400);
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

  test("Get deleted prato returns 404", async () => {
    const res = await authenticatedApi(
      `/api/pratos/${testDishId}`,
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Delete non-existent prato returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pratos/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete prato with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/pratos/not-uuid", adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  test("Delete prato as non-admin returns 403", async () => {
    // Create a new prato to test 403
    const createRes = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Prato 403",
        preco: "15.99",
        categoriaId: pratoCategoryId,
      }),
    });
    await expectStatus(createRes, 201);
    const data = await createRes.json();

    // Try to delete with regular user
    const res = await authenticatedApi(
      `/api/pratos/${data.prato.id}`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // ==================== Pratos Photo Upload ====================
  let fotoPratoId: string;

  test("Create prato for photo upload", async () => {
    const res = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Pasta Carbonara",
        preco: "18.99",
        categoriaId: pratoCategoryId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    fotoPratoId = data.prato.id;
  });

  test("Upload photo for prato", async () => {
    const formData = new FormData();
    const testFile = createTestFile("prato.jpg", "test image content", "image/jpeg");
    formData.append("file", testFile);

    const res = await authenticatedApi(`/api/pratos/${fotoPratoId}/foto`, adminToken, {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  test("Upload photo to non-existent prato returns 404", async () => {
    const formData = new FormData();
    const testFile = createTestFile("prato.jpg", "test image content", "image/jpeg");
    formData.append("file", testFile);

    const res = await authenticatedApi(
      "/api/pratos/00000000-0000-0000-0000-000000000000/foto",
      adminToken,
      {
        method: "POST",
        body: formData,
      }
    );
    await expectStatus(res, 404);
  });

  test("Upload photo to prato with invalid UUID format returns 400", async () => {
    const formData = new FormData();
    const testFile = createTestFile("prato.jpg", "test image content", "image/jpeg");
    formData.append("file", testFile);

    const res = await authenticatedApi("/api/pratos/bad-uuid/foto", adminToken, {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 400);
  });

  test("Upload photo without file returns 400", async () => {
    const formData = new FormData();

    const res = await authenticatedApi(`/api/pratos/${fotoPratoId}/foto`, adminToken, {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 400);
  });

  test("Upload prato photo as non-admin returns 403", async () => {
    const formData = new FormData();
    const testFile = createTestFile("test.jpg", "test", "image/jpeg");
    formData.append("file", testFile);

    const res = await authenticatedApi(`/api/pratos/${fotoPratoId}/foto`, regularUserToken, {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 403);
  });

  // ==================== Mesas CRUD ====================
  test("List all mesas", async () => {
    const res = await authenticatedApi("/api/mesas", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.mesas).toBeDefined();
    expect(Array.isArray(data.mesas)).toBe(true);
  });

  test("List mesas filtered by status", async () => {
    const res = await authenticatedApi(
      "/api/mesas?status=disponivel",
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.mesas).toBeDefined();
    expect(Array.isArray(data.mesas)).toBe(true);
  });

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
    testTableId = data.mesa.id;
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

  test("Get mesa with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/mesas/invalid-uuid", authToken);
    await expectStatus(res, 400);
  });

  test("Create mesa missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/mesas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Create mesa with duplicate numero returns 409", async () => {
    const duplicateNumber = Math.floor(Math.random() * 900000) + 100000;

    // Create first mesa
    const firstRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: duplicateNumber,
      }),
    });
    await expectStatus(firstRes, 201);

    // Try to create with same numero
    const dupRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: duplicateNumber,
      }),
    });
    await expectStatus(dupRes, 409);
  });

  test("Update mesa status", async () => {
    const res = await authenticatedApi(`/api/mesas/${testTableId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ocupada",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent mesa returns 404", async () => {
    const res = await authenticatedApi(
      "/api/mesas/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disponivel" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update mesa with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/mesas/bad-uuid", adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "disponivel" }),
    });
    await expectStatus(res, 400);
  });

  test("Delete mesa as admin", async () => {
    // Create a mesa for deletion
    const createRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(createRes, 201);
    const mesaData = await createRes.json();

    // Delete it
    const res = await authenticatedApi(
      `/api/mesas/${mesaData.mesa.id}`,
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 204);
  });

  test("Delete non-existent mesa returns 404", async () => {
    const res = await authenticatedApi(
      "/api/mesas/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete mesa with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/mesas/not-uuid", adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  test("Delete mesa as non-admin returns 403", async () => {
    // Create a mesa to test 403
    const createRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(createRes, 201);
    const mesaData = await createRes.json();

    // Try to delete with regular user
    const res = await authenticatedApi(
      `/api/mesas/${mesaData.mesa.id}`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // ==================== Mesas Force Delete ====================
  test("Force delete mesa", async () => {
    // Create a mesa for force deletion
    const createRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(createRes, 201);
    const mesaData = await createRes.json();

    // Force delete it
    const res = await authenticatedApi(
      `/api/mesas/${mesaData.mesa.id}/force`,
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 204);
  });

  test("Force delete non-existent mesa returns 404", async () => {
    const res = await authenticatedApi(
      "/api/mesas/00000000-0000-0000-0000-000000000000/force",
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Force delete mesa with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/mesas/invalid-uuid/force", adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  test("Force delete mesa as non-admin returns 403", async () => {
    // Create a mesa to test 403
    const createRes = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(createRes, 201);
    const mesaData = await createRes.json();

    // Try to force delete with regular user
    const res = await authenticatedApi(
      `/api/mesas/${mesaData.mesa.id}/force`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // ==================== Comandas CRUD (depends on mesa) ====================
  let comandaMesaId: string;

  test("Create mesa for comanda", async () => {
    const res = await authenticatedApi("/api/mesas", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: Math.floor(Math.random() * 900000) + 100000,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    comandaMesaId = data.mesa.id;
  });

  // ==================== Mesas Get Current Comanda ====================
  test("Get current comanda for mesa", async () => {
    const res = await authenticatedApi(`/api/mesas/${comandaMesaId}/comanda`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.comanda).toBeDefined();
    // comanda can be null if no open comanda exists
  });

  test("Get current comanda for mesa with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/mesas/invalid-uuid/comanda", authToken);
    await expectStatus(res, 400);
  });

  test("List all comandas", async () => {
    const res = await authenticatedApi("/api/comandas", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.comandas).toBeDefined();
    expect(Array.isArray(data.comandas)).toBe(true);
  });

  test("List comandas filtered by status", async () => {
    const res = await authenticatedApi(
      "/api/comandas?status=aberta",
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.comandas).toBeDefined();
    expect(Array.isArray(data.comandas)).toBe(true);
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

  test("Create comanda missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        garcomId: testUserId,
        // missing required mesaId
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get comanda by ID", async () => {
    const res = await authenticatedApi(`/api/comandas/${testCommandaId}`, authToken);
    await expectStatus(res, 200);
  });

  test("Get non-existent comanda returns 404", async () => {
    const res = await authenticatedApi(
      "/api/comandas/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Get comanda with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/comandas/invalid-uuid", authToken);
    await expectStatus(res, 400);
  });

  // ==================== Comandas Add Pedidos ====================
  let addPedidosPratoId: string;
  let addPedidosCommandaId: string;

  test("Create prato for add pedidos test", async () => {
    const res = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Prato for Bulk Add",
        preco: "15.99",
        categoriaId: pratoCategoryId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    addPedidosPratoId = data.prato.id;
  });

  test("Create comanda for add pedidos test", async () => {
    const res = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    addPedidosCommandaId = data.comanda.id;
  });

  test("Add multiple pedidos to comanda", async () => {
    const res = await authenticatedApi(
      `/api/comandas/${addPedidosCommandaId}/pedidos`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              prato_id: addPedidosPratoId,
              quantidade: 2,
              preco_unitario: 15.99,
              observacao: "Well done",
            },
            {
              prato_id: addPedidosPratoId,
              quantidade: 1,
              preco_unitario: 15.99,
            },
          ],
        }),
      }
    );
    await expectStatus(res, 201);
    const data = await res.json();
    expect(data.pedidos).toBeDefined();
    expect(Array.isArray(data.pedidos)).toBe(true);
    expect(data.pedidos.length).toBe(2);
  });

  test("Add pedidos to non-existent comanda returns 404", async () => {
    const res = await authenticatedApi(
      "/api/comandas/00000000-0000-0000-0000-000000000000/pedidos",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              prato_id: addPedidosPratoId,
              quantidade: 1,
              preco_unitario: 15.99,
            },
          ],
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Add pedidos with invalid comanda UUID returns 400", async () => {
    const res = await authenticatedApi(
      "/api/comandas/invalid-uuid/pedidos",
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              prato_id: addPedidosPratoId,
              quantidade: 1,
              preco_unitario: 15.99,
            },
          ],
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Add pedidos missing required field returns 400", async () => {
    const res = await authenticatedApi(
      `/api/comandas/${addPedidosCommandaId}/pedidos`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              prato_id: addPedidosPratoId,
              // missing required quantidade and preco_unitario
            },
          ],
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Add pedidos with non-existent prato returns 404", async () => {
    const res = await authenticatedApi(
      `/api/comandas/${addPedidosCommandaId}/pedidos`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              prato_id: "00000000-0000-0000-0000-000000000000",
              quantidade: 1,
              preco_unitario: 15.99,
            },
          ],
        }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Close comanda", async () => {
    const res = await authenticatedApi(`/api/comandas/${testCommandaId}/fechar`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total: "50.00",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Close non-existent comanda returns 404", async () => {
    const res = await authenticatedApi(
      "/api/comandas/00000000-0000-0000-0000-000000000000/fechar",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total: "10.00" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Close comanda with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/comandas/bad-uuid/fechar", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total: "10.00" }),
    });
    await expectStatus(res, 400);
  });

  test("Cancel comanda", async () => {
    // Create a new comanda to cancel
    const createRes = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
      }),
    });
    await expectStatus(createRes, 201);
    const createData = await createRes.json();

    const res = await authenticatedApi(`/api/comandas/${createData.comanda.id}/cancelar`, authToken, {
      method: "PUT",
    });
    await expectStatus(res, 200);
  });

  test("Cancel non-existent comanda returns 404", async () => {
    const res = await authenticatedApi(
      "/api/comandas/00000000-0000-0000-0000-000000000000/cancelar",
      authToken,
      {
        method: "PUT",
      }
    );
    await expectStatus(res, 404);
  });

  test("Cancel comanda with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/comandas/not-uuid/cancelar", authToken, {
      method: "PUT",
    });
    await expectStatus(res, 400);
  });

  test("Delete comanda", async () => {
    // Create a new comanda to delete
    const createRes = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
      }),
    });
    await expectStatus(createRes, 201);
    const createData = await createRes.json();

    const res = await authenticatedApi(`/api/comandas/${createData.comanda.id}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Delete non-existent comanda returns 404", async () => {
    const res = await authenticatedApi(
      "/api/comandas/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete comanda with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/comandas/invalid-uuid", authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  // ==================== Pedidos CRUD (depends on comanda and prato) ====================
  let pedidoCommandaId: string;
  let pedidoPratoId: string;

  test("Create prato for pedidos", async () => {
    const res = await authenticatedApi("/api/pratos", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Caesar Salad",
        preco: "12.99",
        categoriaId: pratoCategoryId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    pedidoPratoId = data.prato.id;
  });

  test("Create comanda for pedidos", async () => {
    const res = await authenticatedApi("/api/comandas", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    pedidoCommandaId = data.comanda.id;
  });

  test("List all pedidos", async () => {
    const res = await authenticatedApi("/api/pedidos", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.pedidos).toBeDefined();
    expect(Array.isArray(data.pedidos)).toBe(true);
  });

  test("Create pedido", async () => {
    const res = await authenticatedApi("/api/pedidos", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comanda_id: pedidoCommandaId,
        prato_id: pedidoPratoId,
        quantidade: 2,
        observacao: "Extra dressing",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testPedidoId = data.pedido.id;
  });

  test("Create pedido missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/pedidos", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comanda_id: pedidoCommandaId,
        quantidade: 1,
        // missing required prato_id
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get pedido by ID", async () => {
    const res = await authenticatedApi(`/api/pedidos/${testPedidoId}`, authToken);
    await expectStatus(res, 200);
  });

  test("Get non-existent pedido returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pedidos/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Get pedido with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/pedidos/invalid-uuid", authToken);
    await expectStatus(res, 400);
  });

  test("Update pedido status", async () => {
    const res = await authenticatedApi(`/api/pedidos/${testPedidoId}/status`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "em_preparo",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent pedido status returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pedidos/00000000-0000-0000-0000-000000000000/status",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pronto" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update pedido status with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/pedidos/bad-uuid/status", authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pronto" }),
    });
    await expectStatus(res, 400);
  });

  test("Update pedido status to pronto", async () => {
    const res = await authenticatedApi(`/api/pedidos/${testPedidoId}/status`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "pronto",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update pedido status to entregue", async () => {
    const res = await authenticatedApi(`/api/pedidos/${testPedidoId}/status`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "entregue",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update pedido observacao", async () => {
    const res = await authenticatedApi(`/api/pedidos/${testPedidoId}/observacao`, authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        observacao: "Updated observation - no croutons",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent pedido observacao returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pedidos/00000000-0000-0000-0000-000000000000/observacao",
      authToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacao: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update pedido observacao with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/pedidos/bad-uuid/observacao", authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacao: "Test" }),
    });
    await expectStatus(res, 400);
  });

  test("Update pedido observacao without authentication returns 401", async () => {
    const res = await api(`/api/pedidos/${testPedidoId}/observacao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacao: "Test" }),
    });
    await expectStatus(res, 401);
  });

  test("Delete pedido", async () => {
    const res = await authenticatedApi(`/api/pedidos/${testPedidoId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Get deleted pedido returns 404", async () => {
    const res = await authenticatedApi(`/api/pedidos/${testPedidoId}`, authToken);
    await expectStatus(res, 404);
  });

  test("Delete non-existent pedido returns 404", async () => {
    const res = await authenticatedApi(
      "/api/pedidos/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete pedido with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/pedidos/not-uuid", authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  // ==================== Usuarios CRUD ====================
  const usuarioEmail = `usuario-${Date.now()}@example.com`;

  test("List all usuarios", async () => {
    const res = await authenticatedApi("/api/usuarios", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("Create usuario", async () => {
    const res = await authenticatedApi("/api/usuarios", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Usuario",
        email: usuarioEmail,
        senha: "senha123456",
        role: "garcom",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testUsuarioId = data.id;
  });

  test("Create usuario missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/usuarios", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `usuario2-${Date.now()}@example.com`,
        // missing required nome and senha
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update usuario", async () => {
    const res = await authenticatedApi(`/api/usuarios/${testUsuarioId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Updated Usuario",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent usuario returns 404", async () => {
    const res = await authenticatedApi(
      "/api/usuarios/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update usuario with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/usuarios/invalid-uuid", adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "Test" }),
    });
    await expectStatus(res, 400);
  });

  test("Delete usuario as admin", async () => {
    const res = await authenticatedApi(`/api/usuarios/${testUsuarioId}`, adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Delete non-existent usuario returns 404", async () => {
    const res = await authenticatedApi(
      "/api/usuarios/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete usuario with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/usuarios/bad-uuid", adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 400);
  });

  test("Delete usuario as non-admin returns 403", async () => {
    // Create a usuario first
    const createRes = await authenticatedApi("/api/usuarios", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Test Usuario 403",
        email: `usuario403-${Date.now()}@example.com`,
        senha: "senha123456",
      }),
    });
    await expectStatus(createRes, 201);
    const data = await createRes.json();

    // Try to delete with regular user
    const res = await authenticatedApi(
      `/api/usuarios/${data.id}`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // ==================== Usuarios Garcons ====================
  test("List all usuarios with role='garcom'", async () => {
    const res = await authenticatedApi("/api/usuarios/garcons", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // Verify all returned items have role='garcom'
    data.forEach((usuario: any) => {
      expect(usuario.role).toBe("garcom");
    });
  });

  test("List garcons without authentication returns 401", async () => {
    const res = await api("/api/usuarios/garcons");
    await expectStatus(res, 401);
  });

  // ==================== Garcons CRUD ====================
  const garcomEmail = `garcom-${Date.now()}@example.com`;

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
        name: "Test Garcon",
        email: garcomEmail,
        password: "senha123456",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testGarcomId = data.id;
  });

  test("Create garcon missing required field returns 400", async () => {
    const res = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `garcom2-${Date.now()}@example.com`,
        // missing required name and password
      }),
    });
    await expectStatus(res, 400);
  });

  test("Create garcon with duplicate email returns 409", async () => {
    const dupEmail = `garcom-dup-${Date.now()}@example.com`;

    // Create first garcon
    const firstRes = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "First Garcon",
        email: dupEmail,
        password: "senha123456",
      }),
    });
    await expectStatus(firstRes, 201);

    // Try to create with same email
    const dupRes = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Second Garcon",
        email: dupEmail,
        password: "different",
      }),
    });
    await expectStatus(dupRes, 409);
  });

  test("Create garcon as non-admin returns 403", async () => {
    const res = await authenticatedApi("/api/garcons", regularUserToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Garcon 403",
        email: `garcom-no-admin-${Date.now()}@example.com`,
        password: "senha123456",
      }),
    });
    await expectStatus(res, 403);
  });

  test("Update garcon", async () => {
    const res = await authenticatedApi(`/api/garcons/${testGarcomId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Garcon",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent garcon returns 404", async () => {
    const res = await authenticatedApi(
      "/api/garcons/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update garcon as non-admin returns 403", async () => {
    // Create a garcon first
    const createRes = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Garcon Update 403",
        email: `garcom-update-403-${Date.now()}@example.com`,
        password: "senha123456",
      }),
    });
    await expectStatus(createRes, 201);
    const createData = await createRes.json();

    // Try to update with non-admin user
    const res = await authenticatedApi(`/api/garcons/${createData.id}`, regularUserToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated Garcon",
      }),
    });
    await expectStatus(res, 403);
  });

  test("Delete garcon as admin", async () => {
    const res = await authenticatedApi(`/api/garcons/${testGarcomId}`, adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Delete non-existent garcon returns 404", async () => {
    const res = await authenticatedApi(
      "/api/garcons/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete garcon as non-admin returns 403", async () => {
    // Create a garcon first
    const createRes = await authenticatedApi("/api/garcons", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Garcon 403",
        email: `garcom403-${Date.now()}@example.com`,
        password: "senha123456",
      }),
    });
    await expectStatus(createRes, 201);
    const data = await createRes.json();

    // Try to delete with regular user
    const res = await authenticatedApi(
      `/api/garcons/${data.id}`,
      regularUserToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 403);
  });

  // ==================== Garcom Pedidos ====================
  test("Get authenticated garcom's pedidos", async () => {
    const res = await authenticatedApi("/api/garcom/pedidos", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // Verify response structure
    data.forEach((item: any) => {
      expect(item.numero_sequencial).toBeDefined();
      expect(item.comanda_id).toBeDefined();
      expect(item.mesa_numero).toBeDefined();
      expect(item.created_at).toBeDefined();
      expect(Array.isArray(item.itens)).toBe(true);
    });
  });

  test("Get garcom pedidos without authentication returns 401", async () => {
    const res = await api("/api/garcom/pedidos");
    await expectStatus(res, 401);
  });

  // ==================== Relatorios ====================
  test("Get relatorio resumo", async () => {
    const res = await api("/api/relatorios/resumo");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.total_mesas).toBeDefined();
    expect(data.mesas_ocupadas).toBeDefined();
    expect(data.comandas_abertas).toBeDefined();
    expect(data.pedidos_pendentes).toBeDefined();
    expect(data.receita_hoje).toBeDefined();
    expect(data.receita_semana).toBeDefined();
  });

  // ==================== Upload ====================
  test("Upload image", async () => {
    const formData = new FormData();
    const testFile = createTestFile("test-image.png", "test image content", "image/png");
    formData.append("file", testFile);

    const res = await authenticatedApi("/api/upload/imagem", authToken, {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.url).toBeDefined();
  });

  test("Upload image missing file returns 400", async () => {
    const formData = new FormData();

    const res = await authenticatedApi("/api/upload/imagem", authToken, {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 400);
  });

  test("Upload file", async () => {
    const formData = new FormData();
    const testFile = createTestFile("test-file.txt", "test file content", "text/plain");
    formData.append("file", testFile);

    const res = await authenticatedApi("/api/upload", authToken, {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.url).toBeDefined();
  });

  test("Upload file missing file returns 400", async () => {
    const formData = new FormData();

    const res = await authenticatedApi("/api/upload", authToken, {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 400);
  });

  test("Upload image without authentication returns 401", async () => {
    const formData = new FormData();
    const testFile = createTestFile("test-image.png", "test image content", "image/png");
    formData.append("file", testFile);

    const res = await api("/api/upload/imagem", {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 401);
  });

  test("Upload file without authentication returns 401", async () => {
    const formData = new FormData();
    const testFile = createTestFile("test-file.txt", "test file content", "text/plain");
    formData.append("file", testFile);

    const res = await api("/api/upload", {
      method: "POST",
      body: formData,
    });
    await expectStatus(res, 401);
  });

  // ==================== Debug Endpoints ====================
  test("Debug sign-in with valid credentials", async () => {
    const testEmail = `debug-signin-${Date.now()}@example.com`;
    const testPassword = "debugPassword123456";

    // Create a user first
    const signUpRes = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: "Debug Test User",
      }),
    });
    await expectStatus(signUpRes, 201);

    // Test debug signin
    const res = await api("/api/debug/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.userFound).toBeDefined();
    expect(data.accountFound).toBeDefined();
    expect(data.passwordMatch).toBeDefined();
  });

  test("Debug sign-in with invalid password", async () => {
    const testEmail = `debug-invalid-${Date.now()}@example.com`;
    const testPassword = "correctPassword123456";

    // Create a user first
    const signUpRes = await api("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: "Debug Invalid Test User",
      }),
    });
    await expectStatus(signUpRes, 201);

    // Test debug signin with wrong password
    const res = await api("/api/debug/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "wrongPassword123456",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.userFound).toBeDefined();
    expect(data.accountFound).toBeDefined();
    expect(data.passwordMatch).toBe(false);
  });

  test("Debug sign-in with non-existent user", async () => {
    const res = await api("/api/debug/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent-debug@example.com",
        password: "anyPassword123456",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.userFound).toBeDefined();
    expect(data.userFound).toBe(false);
  });

  test("Get debug usuarios list", async () => {
    const res = await api("/api/debug/usuarios");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.usuarios).toBeDefined();
    expect(Array.isArray(data.usuarios)).toBe(true);
  });

  // ==================== Sign Out (Last Tests) ====================
  test("Sign out authenticated user", async () => {
    // Create a fresh token just for sign-out testing
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
});
