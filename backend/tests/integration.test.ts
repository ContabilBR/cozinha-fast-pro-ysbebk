import { describe, test, expect } from "bun:test";
import { api, authenticatedApi, signUpTestUser, expectStatus } from "./helpers";

describe("API Integration Tests", () => {
  // Shared state for chaining tests
  let authToken: string;
  let adminToken: string;

  // Resource IDs for dependency chaining
  let testUserId: string;
  let testCategoryId: string;
  let testDishId: string;
  let testTableId: string;
  let testOrderId: string;
  let testOrderItemId: string;

  // ==================== Auth Setup ====================
  test("Sign up test user for authentication", async () => {
    const { token, user } = await signUpTestUser();
    authToken = token;
    expect(authToken).toBeDefined();
  });

  test("Authenticate as admin user for user management tests", async () => {
    const res = await api("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@cozinhafast.com",
        password: "Admin@123",
      }),
    });
    const data = await res.json() as any;
    adminToken = data.token;
    expect(adminToken).toBeDefined();
  });

  // ==================== Users CRUD ====================
  test("List all users", async () => {
    const res = await authenticatedApi("/api/users", adminToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Create new user", async () => {
    const res = await authenticatedApi("/api/users", adminToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "newuser@example.com",
        password: "pass123456",
        name: "New User",
        role: "garcom",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testUserId = data.id;
    expect(data.email).toBe("newuser@example.com");
    expect(data.role).toBe("garcom");
  });

  test("Create user missing required field fails", async () => {
    const res = await authenticatedApi("/api/users", adminToken, {
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

  test("Get user by ID", async () => {
    const res = await authenticatedApi(`/api/users/${testUserId}`, adminToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.id).toBe(testUserId);
  });

  test("Get non-existent user returns 404", async () => {
    const res = await authenticatedApi(
      "/api/users/00000000-0000-0000-0000-000000000000",
      adminToken
    );
    await expectStatus(res, 404);
  });

  test("Update user", async () => {
    const res = await authenticatedApi(`/api/users/${testUserId}`, adminToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated User",
        role: "cozinheiro",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.name).toBe("Updated User");
  });

  test("Update non-existent user returns 404", async () => {
    const res = await authenticatedApi(
      "/api/users/00000000-0000-0000-0000-000000000000",
      adminToken,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
      }
    );
    await expectStatus(res, 404);
  });

  test("Deactivate user", async () => {
    const res = await authenticatedApi(`/api/users/${testUserId}`, adminToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
  });

  test("Deactivate non-existent user returns 404", async () => {
    const res = await authenticatedApi(
      "/api/users/00000000-0000-0000-0000-000000000000",
      adminToken,
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
    expect(data.name).toBe("Appetizers");
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
    const data = await res.json();
    expect(data.name).toBe("Updated Appetizers");
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

  test("Delete category", async () => {
    const res = await authenticatedApi(
      `/api/categories/${testCategoryId}`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 200);
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
        categoryId: dishCategoryId,
        price: "25.99",
        prepTimeMinutes: 15,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testDishId = data.id;
    expect(data.name).toBe("Grilled Salmon");
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
    const data = await res.json();
    expect(data.name).toBe("Grilled Salmon with Asparagus");
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

  test("Deactivate dish", async () => {
    const res = await authenticatedApi(`/api/dishes/${testDishId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
  });

  test("Deactivate non-existent dish returns 404", async () => {
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
        number: 5,
        capacity: 4,
        location: "window",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testTableId = data.id;
    expect(data.number).toBe(5);
    expect(data.status).toBe("livre");
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
    const data = await res.json();
    expect(data.status).toBe("ocupada");
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
      method: "DELETE",
    });
    await expectStatus(res, 200);
  });

  test("Deactivate non-existent table returns 404", async () => {
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
        number: 10,
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

  test("Open new order", async () => {
    const res = await authenticatedApi("/api/orders", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableId: orderTableId,
        waiterId: "waiter-1",
        customerCount: 2,
        notes: "No salt",
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    testOrderId = data.id;
    expect(data.tableId).toBe(orderTableId);
  });

  test("Open order missing required field fails", async () => {
    const res = await authenticatedApi("/api/orders", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waiterId: "waiter-1",
        customerCount: 2,
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
        customerCount: 3,
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.status).toBe("fechando");
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

  test("Cancel order", async () => {
    const res = await authenticatedApi(`/api/orders/${testOrderId}`, authToken, {
      method: "DELETE",
    });
    await expectStatus(res, 200);
  });

  test("Cancel non-existent order returns 404", async () => {
    const res = await authenticatedApi(
      "/api/orders/00000000-0000-0000-0000-000000000000",
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 404);
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
        categoryId: dishCategoryId,
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
        tableId: orderTableId,
        waiterId: "waiter-2",
        customerCount: 1,
      }),
    });
    await expectStatus(res, 201);
    const data = await res.json();
    orderItemOrderId = data.id;
  });

  test("List order items", async () => {
    const res = await authenticatedApi(
      `/api/orders/${orderItemOrderId}/items`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Add item to order", async () => {
    const res = await authenticatedApi(
      `/api/orders/${orderItemOrderId}/items`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishId: orderItemDishId,
          quantity: 2,
          notes: "Extra dressing",
        }),
      }
    );
    await expectStatus(res, 201);
    const data = await res.json();
    testOrderItemId = data.id;
    expect(data.dishId).toBe(orderItemDishId);
    expect(data.quantity).toBe(2);
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
    const data = await res.json();
    expect(data.status).toBe("em_preparo");
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

  test("Cancel order item", async () => {
    const res = await authenticatedApi(
      `/api/order-items/${testOrderItemId}`,
      authToken,
      {
        method: "DELETE",
      }
    );
    await expectStatus(res, 200);
  });

  test("Cancel non-existent order item returns 404", async () => {
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
    const res = await authenticatedApi("/api/kitchen/queue", authToken);
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
        tableId: orderTableId,
        waiterId: "waiter-3",
        customerCount: 1,
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
          dishId: orderItemDishId,
          quantity: 1,
        }),
      }
    );
    await expectStatus(itemRes, 201);
    const itemData = await itemRes.json();

    const updateRes = await authenticatedApi(
      `/api/kitchen/items/${itemData.id}/status`,
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
      "/api/kitchen/items/00000000-0000-0000-0000-000000000000/status",
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
    expect(data.totalRevenue).toBeDefined();
    expect(data.ordersCount).toBeDefined();
  });

  test("Get dishes report", async () => {
    const res = await authenticatedApi("/api/reports/dishes", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get tables report", async () => {
    const res = await authenticatedApi("/api/reports/tables", authToken);
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get waiters report", async () => {
    const res = await authenticatedApi("/api/reports/waiters", authToken);
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

  // ==================== Filtering & Query Parameters ====================
  test("Filter dishes by category", async () => {
    const res = await authenticatedApi(
      `/api/dishes?category_id=${dishCategoryId}`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Filter orders by status", async () => {
    const res = await authenticatedApi(
      `/api/orders?status=aberta`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("Get reports with date filters", async () => {
    const res = await authenticatedApi(
      `/api/reports/summary?date_from=2026-01-01&date_to=2026-12-31`,
      authToken
    );
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.totalRevenue).toBeDefined();
  });
});
