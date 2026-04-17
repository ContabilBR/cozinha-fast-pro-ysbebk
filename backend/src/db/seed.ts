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
    const existingCategories = await app.db.select().from(schema.categoriaPratos).limit(1);

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
        .insert(schema.categoriaPratos)
        .values({
          nome: cat.name,
          descricao: `${cat.name} do nosso restaurante`,
        })
        .returning();
      categoryIds[cat.name] = category.id;
    }

    // Seed dishes
    const dishIds: Record<string, string> = {};
    for (const dish of seedDishes) {
      const [createdDish] = await app.db
        .insert(schema.pratos)
        .values({
          nome: dish.name,
          descricao: `Prato delicioso de ${dish.name}`,
          categoriaId: categoryIds[dish.category],
          preco: dish.price,
          imagemUrl: `https://picsum.photos/seed/${dish.image}/400/300`,
          disponivel: true,
        })
        .returning();
      dishIds[dish.name] = createdDish.id;
    }

    // Seed tables
    const tableIds: Record<number, string> = {};
    for (const table of seedTables) {
      const [createdTable] = await app.db
        .insert(schema.mesas)
        .values({
          numero: table.number,
          status: "disponivel",
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
        // Comanda 1: Table 3 - Bruschetta x2 + Frango Grelhado x1
        const [comanda1] = await app.db
          .insert(schema.comandas)
          .values({
            mesaId: tableIds[3],
            garcomId: garcomUserId,
            status: "aberta",
            total: "0",
          })
          .returning();

        // Add items to Comanda 1
        await app.db
          .insert(schema.pedidos)
          .values({
            comandaId: comanda1.id,
            pratoId: coxinhaId,
            quantidade: 2,
            precoUnitario: "18.90",
            status: "pendente",
          });

        await app.db
          .insert(schema.pedidos)
          .values({
            comandaId: comanda1.id,
            pratoId: frangoGrelhadoId,
            quantidade: 1,
            precoUnitario: "45.90",
            status: "pendente",
          });

        // Update Comanda 1 total: (2 * 18.90) + 45.90 = 83.70
        await app.db
          .update(schema.comandas)
          .set({ total: "83.70" })
          .where(eq(schema.comandas.id, comanda1.id));

        app.logger.info({ comandaId: comanda1.id }, "Comanda 1 created");
      }

      if (refrigeranteId && burgerId) {
        // Comanda 2: Table 5 - Suco Natural x2 + X-Burguer x1
        const [comanda2] = await app.db
          .insert(schema.comandas)
          .values({
            mesaId: tableIds[5],
            garcomId: garcomUserId,
            status: "aberta",
            total: "0",
          })
          .returning();

        // Add items to Comanda 2
        await app.db
          .insert(schema.pedidos)
          .values({
            comandaId: comanda2.id,
            pratoId: refrigeranteId,
            quantidade: 2,
            precoUnitario: "12.00",
            status: "pendente",
          });

        await app.db
          .insert(schema.pedidos)
          .values({
            comandaId: comanda2.id,
            pratoId: burgerId,
            quantidade: 1,
            precoUnitario: "38.00",
            status: "pendente",
          });

        // Update Comanda 2 total: (2 * 12.00) + 38.00 = 62.00
        await app.db
          .update(schema.comandas)
          .set({ total: "62.00" })
          .where(eq(schema.comandas.id, comanda2.id));

        app.logger.info({ comandaId: comanda2.id }, "Comanda 2 created");
      }
    }

    app.logger.info("Database seeded successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to seed database");
  }
}
