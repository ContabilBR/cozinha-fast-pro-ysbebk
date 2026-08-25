Edit ONLY the file backend/tests/integration.test.ts. Do not touch any other
part of the file.

Find this exact block (from the "Auth Endpoints: /api/auth/update-user"
section header through its last test) and DELETE it entirely, including the
trailing blank line at the end of the block:

  // ==================== Auth Endpoints: /api/auth/update-user ====================
  test("Update user profile with valid restaurante_id returns 200", async () => {
    const res = await authenticatedApi("/api/auth/update-user", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurante_id: "00000000-0000-0000-0000-000000000001",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Update user profile with valid role returns 200", async () => {
    const res = await authenticatedApi("/api/auth/update-user", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "garcom",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Update user profile with all valid fields returns 200", async () => {
    const res = await authenticatedApi("/api/auth/update-user", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurante_id: "00000000-0000-0000-0000-000000000001",
        role: "gerente",
      }),
    });
    await expectStatus(res, 200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("Update user profile with invalid role returns 400", async () => {
    const res = await authenticatedApi("/api/auth/update-user", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "invalid_role",
      }),
    });
    await expectStatus(res, 400);
  });

  test("Update user profile without authentication returns 401", async () => {
    const res = await api("/api/auth/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "garcom",
      }),
    });
    await expectStatus(res, 401);
  });

  test("Update user profile with empty body returns 200", async () => {
    const res = await authenticatedApi("/api/auth/update-user", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await expectStatus(res, 200);
  });

  test("Update user profile with invalid UUID format returns 400", async () => {
    const res = await authenticatedApi("/api/auth/update-user", authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurante_id: "invalid-uuid",
      }),
    });
    await expectStatus(res, 400);
  });

Do not change anything else in the file — no other test, no other section.

After editing, run and show me:
grep -n "api/auth/update-user" backend/tests/integration.test.ts
(must be empty)
grep -c "^\s*test(" backend/tests/integration.test.ts
(should show 238 — was 245 before this edit)
