import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  let authToken: string;
  let testUserId: string;

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

  // ==================== Users CRUD ====================
  test("List all users", async () => {
    const res = await authenticatedApi("/api/users", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create new user", async () => {
    const res = await authenticatedApi("/api/users", authToken, {
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
    const firstRes = await authenticatedApi("/api/users", authToken, {
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
    const dupRes = await authenticatedApi("/api/users", authToken, {
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

  test("Delete non-existent user returns 404", async () => {
    const res = await authenticatedApi(
      "/api/users/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Categorias CRUD ====================
  test("List all categorias", async () => {
    const res = await api("/api/categorias");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("Create categoria", async () => {
    const res = await api("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Appetizers",
        descricao: "Starters and appetizers",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testCategoryId = data.id;
  });

  test("Create categoria missing required field returns 400", async () => {
    const res = await api("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: "No name category",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update categoria", async () => {
    const res = await api(`/api/categorias/${testCategoryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Updated Appetizers",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent categoria returns 404", async () => {
    const res = await api(
      "/api/categorias/00000000-0000-0000-0000-000000000000",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete categoria", async () => {
    const res = await api(`/api/categorias/${testCategoryId}`, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Delete non-existent categoria returns 404", async () => {
    const res = await api(
      "/api/categorias/00000000-0000-0000-0000-000000000000",
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Pratos CRUD (depends on categoria) ====================
  let pratoCategoryId: string;

  test("Create categoria for pratos", async () => {
    const res = await api("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Main Courses",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    pratoCategoryId = data.id;
  });

  test("List all pratos", async () => {
    const res = await api("/api/pratos");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("Create prato", async () => {
    const res = await api("/api/pratos", {
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
    testDishId = data.id;
  });

  test("Get prato by ID", async () => {
    const res = await api(`/api/pratos/${testDishId}`);
    await expectStatus(res, 200);
  });

  test("Get non-existent prato returns 404", async () => {
    const res = await api(
      "/api/pratos/00000000-0000-0000-0000-000000000000"
    );
    await expectStatus(res, 404);
  });

  test("Create prato missing required field returns 400", async () => {
    const res = await api("/api/pratos", {
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
    const res = await api(`/api/pratos/${testDishId}`, {
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
    const res = await api(
      "/api/pratos/00000000-0000-0000-0000-000000000000",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete prato", async () => {
    const res = await api(`/api/pratos/${testDishId}`, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Get deleted prato returns 404", async () => {
    const res = await api(`/api/pratos/${testDishId}`);
    await expectStatus(res, 404);
  });

  test("Delete non-existent prato returns 404", async () => {
    const res = await api(
      "/api/pratos/00000000-0000-0000-0000-000000000000",
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Mesas CRUD ====================
  test("List all mesas", async () => {
    const res = await api("/api/mesas");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("Create mesa", async () => {
    const res = await api("/api/mesas", {
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
    const res = await api(`/api/mesas/${testTableId}`);
    await expectStatus(res, 200);
  });

  test("Get non-existent mesa returns 404", async () => {
    const res = await api(
      "/api/mesas/00000000-0000-0000-0000-000000000000"
    );
    await expectStatus(res, 404);
  });

  test("Create mesa missing required field returns 400", async () => {
    const res = await api("/api/mesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 400);
  });

  test("Update mesa status", async () => {
    const res = await api(`/api/mesas/${testTableId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ocupada",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent mesa returns 404", async () => {
    const res = await api(
      "/api/mesas/00000000-0000-0000-0000-000000000000",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disponivel" }),
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Comandas CRUD (depends on mesa) ====================
  let comandaMesaId: string;

  test("Create mesa for comanda", async () => {
    const res = await api("/api/mesas", {
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
    const res = await api("/api/comandas");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("Create comanda", async () => {
    const res = await api("/api/comandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
        garcomId: testUserId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testCommandaId = data.id;
  });

  test("Create comanda missing required field returns 400", async () => {
    const res = await api("/api/comandas", {
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
    const res = await api(`/api/comandas/${testCommandaId}`);
    await expectStatus(res, 200);
  });

  test("Get non-existent comanda returns 404", async () => {
    const res = await api(
      "/api/comandas/00000000-0000-0000-0000-000000000000"
    );
    await expectStatus(res, 404);
  });

  test("Close comanda", async () => {
    const res = await api(`/api/comandas/${testCommandaId}/fechar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total: "50.00",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Close non-existent comanda returns 404", async () => {
    const res = await api(
      "/api/comandas/00000000-0000-0000-0000-000000000000/fechar",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total: "10.00" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Cancel comanda", async () => {
    // Create a new comanda to cancel
    const createRes = await api("/api/comandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
      }),
    });
    await expectStatus(createRes, 201);
    const createData = await createRes.json();

    const res = await api(`/api/comandas/${createData.id}/cancelar`, {
      method: "PUT",
    });
    await expectStatus(res, 200);
  });

  test("Cancel non-existent comanda returns 404", async () => {
    const res = await api(
      "/api/comandas/00000000-0000-0000-0000-000000000000/cancelar",
      {
        method: "PUT",
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Pedidos CRUD (depends on comanda and prato) ====================
  let pedidoCommandaId: string;
  let pedidoPratoId: string;

  test("Create prato for pedidos", async () => {
    const res = await api("/api/pratos", {
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
    pedidoPratoId = data.id;
  });

  test("Create comanda for pedidos", async () => {
    const res = await api("/api/comandas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mesaId: comandaMesaId,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    pedidoCommandaId = data.id;
  });

  test("List all pedidos", async () => {
    const res = await api("/api/pedidos");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test("Create pedido", async () => {
    const res = await api("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comandaId: pedidoCommandaId,
        pratoId: pedidoPratoId,
        precoUnitario: "12.99",
        quantidade: 2,
        observacao: "Extra dressing",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testPedidoId = data.id;
  });

  test("Create pedido missing required field returns 400", async () => {
    const res = await api("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comandaId: pedidoCommandaId,
        quantidade: 1,
        // missing required pratoId and precoUnitario
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get pedido by ID", async () => {
    const res = await api(`/api/pedidos/${testPedidoId}`);
    await expectStatus(res, 200);
  });

  test("Get non-existent pedido returns 404", async () => {
    const res = await api(
      "/api/pedidos/00000000-0000-0000-0000-000000000000"
    );
    await expectStatus(res, 404);
  });

  test("Update pedido status", async () => {
    const res = await api(`/api/pedidos/${testPedidoId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "em_preparo",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent pedido status returns 404", async () => {
    const res = await api(
      "/api/pedidos/00000000-0000-0000-0000-000000000000/status",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pronto" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update pedido status to pronto", async () => {
    const res = await api(`/api/pedidos/${testPedidoId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "pronto",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update pedido status to entregue", async () => {
    const res = await api(`/api/pedidos/${testPedidoId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "entregue",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Delete pedido", async () => {
    const res = await api(`/api/pedidos/${testPedidoId}`, {
      method: "DELETE",
    });
    await expectStatus(res, 204);
  });

  test("Get deleted pedido returns 404", async () => {
    const res = await api(`/api/pedidos/${testPedidoId}`);
    await expectStatus(res, 404);
  });

  test("Delete non-existent pedido returns 404", async () => {
    const res = await api(
      "/api/pedidos/00000000-0000-0000-0000-000000000000",
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });
});
