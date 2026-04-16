import { eq } from "drizzle-orm";
import * as schema from "./schema/schema.js";
import { user as userTable } from "./schema/auth-schema.js";
import type { App } from "../index.js";

const seedUsers = [
  {
    id: "user-admin-001",
    name: "Admin Sistema",
    email: "admin@cozinhafast.com",
    password: "admin123",
    role: "admin",
  },
  {
    id: "user-gerente-001",
    name: "Carlos Gerente",
    email: "gerente@cozinhafast.com",
    password: "gerente123",
    role: "gerente",
  },
  {
    id: "user-garcom-001",
    name: "Joao Garcom",
    email: "garcom@cozinhafast.com",
    password: "garcom123",
    role: "garcom",
  },
  {
    id: "user-cozinha-001",
    name: "Maria Cozinheira",
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
  { name: "Bruschetta", category: "Entradas", price: "18.90", prepTime: 10, image: "bruschetta" },
  { name: "Carpaccio", category: "Entradas", price: "32.00", prepTime: 15, image: "carpaccio" },
  { name: "File Mignon", category: "Pratos Principais", price: "89.90", prepTime: 25, image: "filemignon" },
  { name: "Salmao Grelhado", category: "Pratos Principais", price: "72.00", prepTime: 20, image: "salmao" },
  { name: "Frango a Parmegiana", category: "Pratos Principais", price: "54.90", prepTime: 22, image: "frango" },
  { name: "Petit Gateau", category: "Sobremesas", price: "24.90", prepTime: 12, image: "petitgateau" },
  { name: "Pudim de Leite", category: "Sobremesas", price: "16.00", prepTime: 5, image: "pudim" },
  { name: "Suco de Laranja", category: "Bebidas", price: "12.00", prepTime: 5, image: "suco" },
  { name: "Refrigerante", category: "Bebidas", price: "8.00", prepTime: 2, image: "refri" },
  { name: "X-Burguer Especial", category: "Lanches", price: "38.90", prepTime: 18, image: "xburguer" },
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
          userIds[seedUser.id] = result.user.id;
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
    const bruschettaId = dishIds["Bruschetta"];
    const carpaccioId = dishIds["Carpaccio"];
    const fileMignonId = dishIds["File Mignon"];
    const salmaoId = dishIds["Salmao Grelhado"];

    // Order 1: Table 3
    const [order1] = await app.db
      .insert(schema.orders)
      .values({
        tableId: tableIds[3],
        waiterId: "user-garcom-001",
        status: "aberta",
        customerCount: 4,
        totalAmount: "0",
      })
      .returning();

    // Add items to Order 1
    const [item1_1] = await app.db
      .insert(schema.orderItems)
      .values({
        orderId: order1.id,
        dishId: bruschettaId,
        quantity: 1,
        unitPrice: "18.90",
        status: "pendente",
      })
      .returning();

    const [item1_2] = await app.db
      .insert(schema.orderItems)
      .values({
        orderId: order1.id,
        dishId: carpaccioId,
        quantity: 1,
        unitPrice: "32.00",
        status: "pendente",
      })
      .returning();

    // Update Order 1 total
    await app.db
      .update(schema.orders)
      .set({ totalAmount: "50.90" })
      .where(eq(schema.orders.id, order1.id));

    // Order 2: Table 5
    const [order2] = await app.db
      .insert(schema.orders)
      .values({
        tableId: tableIds[5],
        waiterId: "user-garcom-001",
        status: "aberta",
        customerCount: 6,
        totalAmount: "0",
      })
      .returning();

    // Add items to Order 2
    const [item2_1] = await app.db
      .insert(schema.orderItems)
      .values({
        orderId: order2.id,
        dishId: fileMignonId,
        quantity: 1,
        unitPrice: "89.90",
        status: "em_preparo",
        startedAt: new Date(),
      })
      .returning();

    const [item2_2] = await app.db
      .insert(schema.orderItems)
      .values({
        orderId: order2.id,
        dishId: salmaoId,
        quantity: 1,
        unitPrice: "72.00",
        status: "em_preparo",
        startedAt: new Date(),
      })
      .returning();

    // Update Order 2 total
    await app.db
      .update(schema.orders)
      .set({ totalAmount: "161.90" })
      .where(eq(schema.orders.id, order2.id));

    app.logger.info("Database seeded successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to seed database");
  }
}
