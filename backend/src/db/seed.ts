import { eq } from "drizzle-orm";
import * as schema from "./schema/schema.js";
import { user as userTable, account as accountTable } from "./schema/auth-schema.js";
import type { App } from "../index.js";
import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";

const seedUsers = [
  {
    name: "Administrador",
    email: "admin@cozinhafast.com",
    password: "admin123",
    role: "administrador",
  },
  {
    name: "Gerente",
    email: "gerente@cozinhafast.com",
    password: "gerente123",
    role: "gerente",
  },
  {
    name: "Garçom",
    email: "garcom@cozinhafast.com",
    password: "garcom123",
    role: "garcom",
  },
  {
    name: "Cozinheiro",
    email: "cozinheiro@cozinhafast.com",
    password: "cozinheiro123",
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
  { name: "Sopa do Dia", category: "Entradas", price: "22.00", prepTime: 15, image: "soup" },
  { name: "Frango Grelhado", category: "Pratos Principais", price: "45.90", prepTime: 25, image: "chicken" },
  { name: "Filé Mignon", category: "Pratos Principais", price: "89.90", prepTime: 30, image: "steak" },
  { name: "Massa Carbonara", category: "Pratos Principais", price: "52.00", prepTime: 20, image: "pasta" },
  { name: "Salmão Grelhado", category: "Pratos Principais", price: "78.00", prepTime: 25, image: "salmon" },
  { name: "Pudim de Leite", category: "Sobremesas", price: "16.00", prepTime: 5, image: "pudding" },
  { name: "Petit Gateau", category: "Sobremesas", price: "24.00", prepTime: 10, image: "cake" },
  { name: "Suco Natural", category: "Bebidas", price: "12.00", prepTime: 5, image: "juice" },
  { name: "X-Burguer Especial", category: "Lanches", price: "38.00", prepTime: 15, image: "burger" },
];

const seedTables = [
  { number: 1, capacity: 4, location: "Salão Principal", status: "disponivel" },
  { number: 2, capacity: 4, location: "Salão Principal", status: "disponivel" },
  { number: 3, capacity: 6, location: "Salão Principal", status: "disponivel" },
  { number: 4, capacity: 4, location: "Varanda", status: "disponivel" },
  { number: 5, capacity: 8, location: "Salão VIP", status: "disponivel" },
  { number: 6, capacity: 2, location: "Varanda", status: "disponivel" },
  { number: 7, capacity: 4, location: "Salão Principal", status: "disponivel" },
  { number: 8, capacity: 6, location: "Salão VIP", status: "disponivel" },
];

export async function seedDatabase(app: App) {
  try {
    app.logger.info("Starting database seed");

    // Always ensure seed users exist (upsert behavior)
    app.logger.info("Ensuring seed users exist");
    const userIds: Record<string, string> = {};
    let garcomUserId = "";

    for (const seedUser of seedUsers) {
      try {
        // Check if user already exists
        const existing = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.email, seedUser.email))
          .limit(1);

        const userId = existing.length > 0 ? existing[0].id : randomUUID();
        const now = new Date();

        if (existing.length > 0) {
          // Update existing user
          await app.db
            .update(userTable)
            .set({
              name: seedUser.name,
              emailVerified: true,
              role: seedUser.role as any,
              active: true,
              updatedAt: now,
            })
            .where(eq(userTable.id, userId));

          // Update or create account with new password
          const existingAccount = await app.db
            .select()
            .from(accountTable)
            .where(eq(accountTable.userId, userId))
            .limit(1);

          const hashedPassword = await bcrypt.hash(seedUser.password, 10);
          if (existingAccount.length > 0) {
            await app.db
              .update(accountTable)
              .set({
                password: hashedPassword,
                updatedAt: now,
              })
              .where(eq(accountTable.userId, userId));
          } else {
            await app.db.insert(accountTable).values({
              id: randomUUID(),
              accountId: userId,
              providerId: "credential",
              userId: userId,
              password: hashedPassword,
              createdAt: now,
              updatedAt: now,
            });
          }

          app.logger.info({ email: seedUser.email, userId }, "User updated");
        } else {
          // Create new user
          await app.db.insert(userTable).values({
            id: userId,
            name: seedUser.name,
            email: seedUser.email,
            emailVerified: true,
            role: seedUser.role as any,
            active: true,
            createdAt: now,
            updatedAt: now,
          });

          // Hash password and create account
          const hashedPassword = await bcrypt.hash(seedUser.password, 10);
          await app.db.insert(accountTable).values({
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            userId: userId,
            password: hashedPassword,
            createdAt: now,
            updatedAt: now,
          });

          // Create profile
          await app.db.insert(schema.profiles).values({
            id: randomUUID(),
            userId: userId,
            role: seedUser.role,
            name: seedUser.name,
            createdAt: now,
          });

          app.logger.info({ email: seedUser.email, userId }, "User created");
        }

        userIds[seedUser.email] = userId;
        if (seedUser.role === "garcom") {
          garcomUserId = userId;
        }
      } catch (err) {
        app.logger.warn({ email: seedUser.email, err }, "Failed to upsert user");
      }
    }

    // Check if database already seeded (categories)
    const existingCategories = await app.db.select().from(schema.categories).limit(1);

    if (existingCategories.length > 0) {
      app.logger.info("Database categories and other data already seeded");
      app.logger.info("Database seed completed");
      return;
    }

    app.logger.info("Seeding categories, dishes, and tables");

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

    // Seed orders with items
    if (garcomUserId && Object.keys(dishIds).length > 0) {
      const coxinhaId = dishIds["Bruschetta"];
      const frangoGrelhadoId = dishIds["Frango Grelhado"];
      const refrigeranteId = dishIds["Suco Natural"];
      const burgerId = dishIds["X-Burguer Especial"];

      if (coxinhaId && frangoGrelhadoId) {
        // Order 1: Table 3 - Bruschetta x2 + Frango Grelhado x1
        const [order1] = await app.db
          .insert(schema.orders)
          .values({
            tableId: tableIds[3],
            waiterId: garcomUserId,
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
            unitPrice: "18.90",
            status: "pendente",
            requestedAt: new Date(),
          });

        await app.db
          .insert(schema.orderItems)
          .values({
            orderId: order1.id,
            dishId: frangoGrelhadoId,
            quantity: 1,
            unitPrice: "45.90",
            status: "pendente",
            requestedAt: new Date(),
          });

        // Update Order 1 total: (2 * 18.90) + 45.90 = 83.70
        await app.db
          .update(schema.orders)
          .set({ totalAmount: "83.70" })
          .where(eq(schema.orders.id, order1.id));

        app.logger.info({ orderId: order1.id }, "Order 1 created");
      }

      if (refrigeranteId && burgerId) {
        // Order 2: Table 5 - Suco Natural x2 + X-Burguer x1
        const [order2] = await app.db
          .insert(schema.orders)
          .values({
            tableId: tableIds[5],
            waiterId: garcomUserId,
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
            unitPrice: "12.00",
            status: "pendente",
            requestedAt: new Date(),
          });

        await app.db
          .insert(schema.orderItems)
          .values({
            orderId: order2.id,
            dishId: burgerId,
            quantity: 1,
            unitPrice: "38.00",
            status: "pendente",
            requestedAt: new Date(),
          });

        // Update Order 2 total: (2 * 12.00) + 38.00 = 62.00
        await app.db
          .update(schema.orders)
          .set({ totalAmount: "62.00" })
          .where(eq(schema.orders.id, order2.id));

        app.logger.info({ orderId: order2.id }, "Order 2 created");
      }
    }

    app.logger.info("Database seeded successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to seed database");
  }
}
