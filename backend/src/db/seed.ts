import { eq } from "drizzle-orm";
import * as schema from "./schema/schema.js";
import { user as userTable } from "./schema/auth-schema.js";
import type { App } from "../index.js";

const seedUsers = [
  {
    name: "Administrador",
    email: "admin@cozinhafast.com",
    password: "admin123",
    role: "admin",
  },
  {
    name: "Gerente Silva",
    email: "gerente@cozinhafast.com",
    password: "gerente123",
    role: "gerente",
  },
  {
    name: "João Garçom",
    email: "garcom@cozinhafast.com",
    password: "garcom123",
    role: "garcom",
  },
  {
    name: "Chef Carlos",
    email: "cozinheiro@cozinhafast.com",
    password: "cozinha123",
    role: "cozinheiro",
  },
];

const seedCategories = [
  { name: "Entradas", icon: "appetizer", color: "#FF6B35" },
  { name: "Pratos Principais", icon: "restaurant", color: "#E63946" },
  { name: "Sobremesas", icon: "cake", color: "#F4A261" },
  { name: "Bebidas", icon: "local_bar", color: "#2A9D8F" },
  { name: "Lanches", icon: "lunch_dining", color: "#457B9D" },
];

const seedDishes = [
  { name: "Coxinha de Frango", category: "Entradas", price: "8.90", prepTime: 10, image: "coxinha" },
  { name: "Pastel de Queijo", category: "Entradas", price: "9.90", prepTime: 10, image: "pastel" },
  { name: "Frango Grelhado", category: "Pratos Principais", price: "32.90", prepTime: 20, image: "frango" },
  { name: "Picanha na Brasa", category: "Pratos Principais", price: "58.90", prepTime: 25, image: "picanha" },
  { name: "Filé de Tilápia", category: "Pratos Principais", price: "38.90", prepTime: 20, image: "tilapia" },
  { name: "Pudim de Leite", category: "Sobremesas", price: "12.90", prepTime: 5, image: "pudim" },
  { name: "Mousse de Chocolate", category: "Sobremesas", price: "14.90", prepTime: 5, image: "mousse" },
  { name: "Suco de Laranja", category: "Bebidas", price: "8.90", prepTime: 2, image: "suco" },
  { name: "Refrigerante", category: "Bebidas", price: "6.90", prepTime: 2, image: "refri" },
  { name: "X-Burguer", category: "Lanches", price: "24.90", prepTime: 15, image: "xburguer" },
];

const seedTables = [
  { number: 1, capacity: 4, location: "Salao Principal", status: "livre" },
  { number: 2, capacity: 2, location: "Salao Principal", status: "livre" },
  { number: 3, capacity: 6, location: "Salao Principal", status: "ocupada" },
  { number: 4, capacity: 4, location: "Varanda", status: "livre" },
  { number: 5, capacity: 8, location: "Salao VIP", status: "ocupada" },
  { number: 6, capacity: 2, location: "Varanda", status: "livre" },
  { number: 7, capacity: 4, location: "Salao Principal", status: "livre" },
  { number: 8, capacity: 6, location: "Salao VIP", status: "livre" },
];

export async function seedDatabase(app: App) {
  try {
    // Check if database already seeded
    const existingCategories = await app.db.select().from(schema.categories).limit(1);

    if (existingCategories.length > 0) {
      app.logger.info("Database already seeded");
      return;
    }

    app.logger.info("Starting database seed");

    // Seed categories
    const categoryIds: Record<string, string> = {};
    for (const cat of seedCategories) {
      const [category] = await app.db
        .insert(schema.categories)
        .values({
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          active: true,
        })
        .returning();
      categoryIds[cat.name] = category.id;
    }

    // Seed dishes
    const dishIds: Record<string, string> = {};
    for (const dish of seedDishes) {
      const [createdDish] = await app.db
        .insert(schema.dishes)
        .values({
          name: dish.name,
          categoryId: categoryIds[dish.category],
          price: dish.price,
          prepTimeMinutes: dish.prepTime,
          imageUrl: `https://picsum.photos/seed/${dish.image}/400/300`,
          active: true,
        })
        .returning();
      dishIds[dish.name] = createdDish.id;
    }

    // Seed tables
    const tableIds: Record<number, string> = {};
    for (const table of seedTables) {
      const [createdTable] = await app.db
        .insert(schema.tables)
        .values({
          number: table.number,
          capacity: table.capacity,
          location: table.location,
          status: table.status as any,
          active: true,
        })
        .returning();
      tableIds[table.number] = createdTable.id;
    }

    // Seed users
    const userIds: Record<string, string> = {};
    let garmcomUserId = "";
    for (const seedUser of seedUsers) {
      try {
        // Use Better Auth signup API
        const result = await app.auth.api.signUpEmail({
          body: {
            email: seedUser.email,
            password: seedUser.password,
            name: seedUser.name,
          },
        });

        if (result.user) {
          userIds[seedUser.email] = result.user.id;
          if (seedUser.role === "garcom") {
            garmcomUserId = result.user.id;
          }
          // Update role
          await app.db
            .update(userTable)
            .set({ role: seedUser.role as any })
            .where(eq(userTable.id, result.user.id));
        }
      } catch (err) {
        app.logger.warn({ email: seedUser.email }, "Failed to create user via Better Auth, user may already exist");
      }
    }

    // Seed orders with items
    if (garmcomUserId) {
      const coxinhaId = dishIds["Coxinha de Frango"];
      const frangoGrelhadoId = dishIds["Frango Grelhado"];
      const refrigeranteId = dishIds["Refrigerante"];
      const xburgerId = dishIds["X-Burguer"];

      // Order 1: Table 3 - Coxinha x2 + Frango Grelhado x1
      const [order1] = await app.db
        .insert(schema.orders)
        .values({
          tableId: tableIds[3],
          waiterId: garmcomUserId,
          status: "aberta",
          customerCount: 2,
          totalAmount: "0",
          openedAt: new Date(),
        })
        .returning();

      // Add items to Order 1
      await app.db
        .insert(schema.orderItems)
        .values({
          orderId: order1.id,
          dishId: coxinhaId,
          quantity: 2,
          unitPrice: "8.90",
          status: "pendente",
          requestedAt: new Date(),
        });

      await app.db
        .insert(schema.orderItems)
        .values({
          orderId: order1.id,
          dishId: frangoGrelhadoId,
          quantity: 1,
          unitPrice: "32.90",
          status: "pendente",
          requestedAt: new Date(),
        });

      // Update Order 1 total: (2 * 8.90) + 32.90 = 50.70
      await app.db
        .update(schema.orders)
        .set({ totalAmount: "50.70" })
        .where(eq(schema.orders.id, order1.id));

      // Order 2: Table 5 - Refrigerante x2 + X-Burguer x1
      const [order2] = await app.db
        .insert(schema.orders)
        .values({
          tableId: tableIds[5],
          waiterId: garmcomUserId,
          status: "aberta",
          customerCount: 2,
          totalAmount: "0",
          openedAt: new Date(),
        })
        .returning();

      // Add items to Order 2
      await app.db
        .insert(schema.orderItems)
        .values({
          orderId: order2.id,
          dishId: refrigeranteId,
          quantity: 2,
          unitPrice: "6.90",
          status: "pendente",
          requestedAt: new Date(),
        });

      await app.db
        .insert(schema.orderItems)
        .values({
          orderId: order2.id,
          dishId: xburgerId,
          quantity: 1,
          unitPrice: "24.90",
          status: "pendente",
          requestedAt: new Date(),
        });

      // Update Order 2 total: (2 * 6.90) + 24.90 = 38.70
      await app.db
        .update(schema.orders)
        .set({ totalAmount: "38.70" })
        .where(eq(schema.orders.id, order2.id));
    }

    app.logger.info("Database seeded successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to seed database");
  }
}
