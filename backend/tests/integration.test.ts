import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests
  let authToken: string;

  // Resource IDs for dependency chaining
  let testUserId: string;
  let testCategoryId: string;
  let testDishId: string;
  let testTableId: string;
  let testOrderId: string;
  let testOrderItemId: string;

  // Generate unique table numbers to avoid conflicts with seeded data
  const baseTableNumber = Math.floor(Math.random() * 900000) + 100000;
  const tableNumber1 = baseTableNumber;
  const tableNumber2 = baseTableNumber + 1;

  // Generate unique email for test user
  const uniqueEmail = `test-${Date.now()}@example.com`;

  // ==================== Auth Setup ====================
  test("Sign up test user for authentication", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
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
        email: uniqueEmail,
        password: "pass123456",
        name: "New User",
        role: "garcom",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testUserId = data.id;
  });

  test("Create user with duplicate email returns 409", async () => {
    const res = await authenticatedApi("/api/users", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: uniqueEmail,
        password: "different-password",
        name: "Duplicate User",
        role: "gerente",
      }),
    });
    await expectStatus(res, 409);
  });

  test("Create user missing required field fails", async () => {
    const res = await authenticatedApi("/api/users", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: "pass123",
        name: "No Email User",
        role: "garcom",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update user", async () => {
    const res = await authenticatedApi(`/api/users/${testUserId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated User",
        role: "cozinheiro",
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

  test("Deactivate user", async () => {
    const res = await authenticatedApi(`/api/users/${testUserId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    await expectStatus(res, 200);
  });

  test("Delete user", async () => {
    const res = await authenticatedApi(
      `/api/users/${testUserId}`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 204);
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

  // ==================== Categories CRUD ====================
  test("List all categories", async () => {
    const res = await authenticatedApi("/api/categories", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create category", async () => {
    const res = await authenticatedApi("/api/categories", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Appetizers",
        description: "Starters",
        color: "#FF5733",
        icon: "🍽️",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testCategoryId = data.id;
  });

  test("Create category missing required field fails", async () => {
    const res = await authenticatedApi("/api/categories", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "No name category",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update category", async () => {
    const res = await authenticatedApi(
      `/api/categories/${testCategoryId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Appetizers",
        }),
      }
    );
    await expectStatus(res, 200);
  });

  test("Update non-existent category returns 404", async () => {
    const res = await authenticatedApi(
      "/api/categories/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Deactivate category", async () => {
    const res = await authenticatedApi(
      `/api/categories/${testCategoryId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }
    );
    await expectStatus(res, 200);
  });

  test("Delete category", async () => {
    const res = await authenticatedApi(
      `/api/categories/${testCategoryId}`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 204);
  });

  test("Delete non-existent category returns 404", async () => {
    const res = await authenticatedApi(
      "/api/categories/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Dishes CRUD (depends on category) ====================
  let dishCategoryId: string;

  test("Create category for dishes", async () => {
    const res = await authenticatedApi("/api/categories", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Main Courses",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    dishCategoryId = data.id;
  });

  test("List dishes", async () => {
    const res = await authenticatedApi("/api/dishes", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create dish", async () => {
    const res = await authenticatedApi("/api/dishes", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Grilled Salmon",
        description: "Fresh salmon",
        category_id: dishCategoryId,
        price: "25.99",
        prep_time_minutes: 15,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testDishId = data.id;
  });

  test("Get dish by ID", async () => {
    const res = await authenticatedApi(`/api/dishes/${testDishId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(testDishId);
  });

  test("Get dish with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/dishes/invalid-uuid-format",
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Create dish missing required field fails", async () => {
    const res = await authenticatedApi("/api/dishes", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pasta",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update dish", async () => {
    const res = await authenticatedApi(`/api/dishes/${testDishId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Grilled Salmon with Asparagus",
        price: "27.99",
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent dish returns 404", async () => {
    const res = await authenticatedApi(
      "/api/dishes/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Update dish with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/dishes/invalid-uuid-format",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Delete dish", async () => {
    const res = await authenticatedApi(`/api/dishes/${testDishId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
  });

  test("Get deleted dish returns 404", async () => {
    const res = await authenticatedApi(`/api/dishes/${testDishId}`, authToken);
    await expectStatus(res, 404);
  });

  test("Delete non-existent dish returns 404", async () => {
    const res = await authenticatedApi(
      "/api/dishes/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Tables CRUD ====================
  test("List all tables", async () => {
    const res = await authenticatedApi("/api/tables", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create table", async () => {
    const res = await authenticatedApi("/api/tables", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: tableNumber1,
        capacity: 4,
        location: "window",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testTableId = data.id;
  });

  test("Get table by ID", async () => {
    const res = await authenticatedApi(`/api/tables/${testTableId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(testTableId);
  });

  test("Get table with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/tables/invalid-uuid-format",
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Create table missing required field fails", async () => {
    const res = await authenticatedApi("/api/tables", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capacity: 4,
        location: "window",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update table", async () => {
    const res = await authenticatedApi(`/api/tables/${testTableId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ocupada",
        capacity: 6,
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent table returns 404", async () => {
    const res = await authenticatedApi(
      "/api/tables/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "livre" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Deactivate table", async () => {
    const res = await authenticatedApi(`/api/tables/${testTableId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    await expectStatus(res, 200);
  });

  test("Delete table", async () => {
    const res = await authenticatedApi(
      `/api/tables/${testTableId}`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 204);
  });

  test("Get deleted table returns 404", async () => {
    const res = await authenticatedApi(`/api/tables/${testTableId}`, authToken);
    await expectStatus(res, 404);
  });

  test("Delete non-existent table returns 404", async () => {
    const res = await authenticatedApi(
      "/api/tables/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Orders CRUD (depends on table) ====================
  let orderTableId: string;

  test("Create table for orders", async () => {
    const res = await authenticatedApi("/api/tables", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: tableNumber2,
        capacity: 4,
        location: "corner",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    orderTableId = data.id;
  });

  test("List orders", async () => {
    const res = await authenticatedApi("/api/orders", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create new order", async () => {
    const res = await authenticatedApi("/api/orders", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: orderTableId,
        waiter_id: testUserId,
        customer_count: 2,
        notes: "No salt",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testOrderId = data.id;
  });

  test("Create order missing required field fails", async () => {
    const res = await authenticatedApi("/api/orders", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waiter_id: "waiter-1",
        customer_count: 2,
      }),
    });
    await expectStatus(res, 400);
  });

  test("Get order by ID", async () => {
    const res = await authenticatedApi(`/api/orders/${testOrderId}`, authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(testOrderId);
  });

  test("Get order with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi(
      "/api/orders/invalid-uuid-format",
      authToken
    );
    await expectStatus(res, 400);
  });

  test("Get non-existent order returns 404", async () => {
    const res = await authenticatedApi(
      "/api/orders/00000000-0000-0000-0000-000000000000",
      authToken
    );
    await expectStatus(res, 404);
  });

  test("Update order", async () => {
    const res = await authenticatedApi(`/api/orders/${testOrderId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "fechando",
        customer_count: 3,
      }),
    });
    await expectStatus(res, 200);
  });

  test("Update non-existent order returns 404", async () => {
    const res = await authenticatedApi(
      "/api/orders/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "aberta" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Cancel order by changing status", async () => {
    const res = await authenticatedApi(`/api/orders/${testOrderId}`, authToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "cancelada",
      }),
    });
    await expectStatus(res, 200);
  });

  // ==================== Order Items CRUD ====================
  let orderItemOrderId: string;
  let orderItemDishId: string;

  test("Create dish for order items", async () => {
    const res = await authenticatedApi("/api/dishes", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Caesar Salad",
        category_id: dishCategoryId,
        price: "12.99",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    orderItemDishId = data.id;
  });

  test("Create order for items", async () => {
    const res = await authenticatedApi("/api/orders", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: orderTableId,
        waiter_id: testUserId,
        customer_count: 1,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    orderItemOrderId = data.id;
  });

  test("Add item to order", async () => {
    const res = await authenticatedApi(
      `/api/orders/${orderItemOrderId}/items`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish_id: orderItemDishId,
          quantity: 2,
          notes: "Extra dressing",
        }),
      }
    );
    await expectStatus(res, 201);
    const data = await res.json();
    testOrderItemId = data.id;
  });

  test("Add item missing required field fails", async () => {
    const res = await authenticatedApi(
      `/api/orders/${orderItemOrderId}/items`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: 1,
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Add item to order with invalid order ID returns 400", async () => {
    const res = await authenticatedApi(
      `/api/orders/invalid-uuid-format/items`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish_id: orderItemDishId,
          quantity: 1,
        }),
      }
    );
    await expectStatus(res, 400);
  });

  test("Update order item", async () => {
    const res = await authenticatedApi(
      `/api/order-items/${testOrderItemId}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "em_preparo",
          quantity: 3,
        }),
      }
    );
    await expectStatus(res, 200);
  });

  test("Update non-existent order item returns 404", async () => {
    const res = await authenticatedApi(
      "/api/order-items/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pronto" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Delete order item", async () => {
    const res = await authenticatedApi(
      `/api/order-items/${testOrderItemId}`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 200);
  });

  test("Delete non-existent order item returns 404", async () => {
    const res = await authenticatedApi(
      "/api/order-items/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Kitchen ====================
  test("Get kitchen queue", async () => {
    const res = await authenticatedApi("/api/kitchen/items", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Update kitchen item status with valid item", async () => {
    // Create order and item for kitchen
    const orderRes = await authenticatedApi("/api/orders", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: orderTableId,
        waiter_id: testUserId,
        customer_count: 1,
      }),
    });
    await expectStatus(orderRes, 201);
    const orderData = await orderRes.json();

    const itemRes = await authenticatedApi(
      `/api/orders/${orderData.id}/items`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish_id: orderItemDishId,
          quantity: 1,
        }),
      }
    );
    await expectStatus(itemRes, 201);
    const itemData = await itemRes.json();

    const updateRes = await authenticatedApi(
      `/api/kitchen/items/${itemData.id}`,
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "recebido",
        }),
      }
    );
    await expectStatus(updateRes, 200);
  });

  test("Update non-existent kitchen item returns 404", async () => {
    const res = await authenticatedApi(
      "/api/kitchen/items/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pronto" }),
      }
    );
    await expectStatus(res, 404);
  });

  // ==================== Reports ====================
  test("Get revenue summary report", async () => {
    const res = await authenticatedApi("/api/reports/summary", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test("Get reports with date filters", async () => {
    const res = await authenticatedApi(
      `/api/reports/summary?date_from=2026-01-01T00:00:00Z&date_to=2026-12-31T23:59:59Z`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test("Get orders report", async () => {
    const res = await authenticatedApi("/api/reports/orders", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get orders report with date filters", async () => {
    const res = await authenticatedApi(
      `/api/reports/orders?date_from=2026-01-01T00:00:00Z&date_to=2026-12-31T23:59:59Z`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // ==================== Dashboard ====================
  test("Get dashboard summary", async () => {
    const res = await authenticatedApi("/api/dashboard", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.tablesStatus).toBeDefined();
    expect(data.openOrdersCount).toBeDefined();
  });

  // ==================== Portuguese Alternative Endpoints ====================
  test("List all mesas (tables Portuguese endpoint)", async () => {
    const res = await api("/api/mesas");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.mesas).toBeDefined();
    expect(Array.isArray(data.mesas)).toBe(true);
  });

  test("List all categorias (categories Portuguese endpoint)", async () => {
    const res = await api("/api/categorias");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.categorias).toBeDefined();
    expect(Array.isArray(data.categorias)).toBe(true);
  });

  test("List all pratos (dishes Portuguese endpoint)", async () => {
    const res = await api("/api/pratos");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.pratos).toBeDefined();
    expect(Array.isArray(data.pratos)).toBe(true);
  });

  test("List all comandas (orders Portuguese endpoint)", async () => {
    const res = await api("/api/comandas");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.comandas).toBeDefined();
    expect(Array.isArray(data.comandas)).toBe(true);
  });

  test("List all usuarios (users Portuguese endpoint)", async () => {
    const res = await api("/api/usuarios");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.usuarios).toBeDefined();
    expect(Array.isArray(data.usuarios)).toBe(true);
  });

  test("List kitchen items via cozinha endpoint", async () => {
    const res = await api("/api/cozinha");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.itens).toBeDefined();
    expect(Array.isArray(data.itens)).toBe(true);
  });

  test("Get summary report via relatorios resumo endpoint", async () => {
    const res = await api("/api/relatorios/resumo");
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.totalPedidosHoje).toBeDefined();
    expect(data.receitaHoje).toBeDefined();
    expect(data.mesasAtivas).toBeDefined();
    expect(data.itensPendentes).toBeDefined();
  });
});
