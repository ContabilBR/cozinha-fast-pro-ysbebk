import { eq } from "drizzle-orm";
import * as schema from "./schema/schema.js";
import { user as userTable, account as accountTable } from "./schema/auth-schema.js";
import type { App } from "../index.js";
import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";

const seedAuthUsers = [
  {
    name: "Administrador",
    email: "admin@cozinhafast.com",
    password: "admin123",
    role: "admin",
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

const seedCategorias = [
  { nome: "Entradas", descricao: "Aperitivos e entradas" },
  { nome: "Pratos Principais", descricao: "Pratos principais do cardápio" },
  { nome: "Sobremesas", descricao: "Doces e sobremesas" },
  { nome: "Bebidas", descricao: "Bebidas quentes e frias" },
  { nome: "Lanches", descricao: "Sanduíches e lanches" },
];

const seedPratos = [
  {
    nome: "Coxinha de Frango",
    descricao: "Coxinha crocante recheada com frango desfiado",
    preco: "8.50",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato1/400/300",
  },
  {
    nome: "Pão de Queijo",
    descricao: "Pão de queijo mineiro quentinho",
    preco: "5.00",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato2/400/300",
  },
  {
    nome: "Frango Grelhado",
    descricao: "Filé de frango grelhado com legumes",
    preco: "32.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato3/400/300",
  },
  {
    nome: "Picanha na Brasa",
    descricao: "Picanha grelhada com arroz, feijão e farofa",
    preco: "58.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato4/400/300",
  },
  {
    nome: "Moqueca de Peixe",
    descricao: "Moqueca baiana com arroz e pirão",
    preco: "49.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato5/400/300",
  },
  {
    nome: "Pudim de Leite",
    descricao: "Pudim de leite condensado com calda de caramelo",
    preco: "12.00",
    categoria: "Sobremesas",
    imagemUrl: "https://picsum.photos/seed/prato6/400/300",
  },
  {
    nome: "Suco de Laranja",
    descricao: "Suco de laranja natural 500ml",
    preco: "9.00",
    categoria: "Bebidas",
    imagemUrl: "https://picsum.photos/seed/prato7/400/300",
  },
  {
    nome: "X-Burguer Especial",
    descricao: "Hambúrguer artesanal com queijo, alface e tomate",
    preco: "28.90",
    categoria: "Lanches",
    imagemUrl: "https://picsum.photos/seed/prato8/400/300",
  },
];

const seedUsuarios = [
  { nome: "Administrador", email: "admin@cozinhafast.com", password: "admin123", role: "admin" },
  { nome: "Gerente", email: "gerente@cozinhafast.com", password: "gerente123", role: "gerente" },
  { nome: "Garçom", email: "garcom@cozinhafast.com", password: "garcom123", role: "garcom" },
  { nome: "Cozinheiro", email: "cozinheiro@cozinhafast.com", password: "cozinheiro123", role: "cozinheiro" },
];

export async function seedDatabase(app: App) {
  try {
    app.logger.info("Starting database seed");

    // Seed auth users
    app.logger.info("Seeding auth users");
    const userIds: Record<string, string> = {};
    let garcomUserId = "";

    for (const seedUser of seedAuthUsers) {
      try {
        const existing = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.email, seedUser.email))
          .limit(1);

        const userId = existing.length > 0 ? existing[0].id : randomUUID();
        const now = new Date();

        if (existing.length === 0) {
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

          app.logger.info({ email: seedUser.email, userId }, "Auth user created");
        }

        userIds[seedUser.email] = userId;
        if (seedUser.role === "garcom") {
          garcomUserId = userId;
        }
      } catch (err) {
        app.logger.warn({ email: seedUser.email, err }, "Failed to seed auth user");
      }
    }

    // Check if already seeded
    const existingMesas = await app.db.select().from(schema.mesas).limit(1);
    if (existingMesas.length > 0) {
      app.logger.info("Database already seeded");
      return;
    }

    // Seed mesas (10 tables)
    app.logger.info("Seeding mesas");
    for (let i = 1; i <= 10; i++) {
      await app.db.insert(schema.mesas).values({
        numero: i,
        status: "livre",
        capacidade: 4,
      });
    }
    app.logger.info("Mesas seeded successfully");

    // Seed categorias
    app.logger.info("Seeding categorias");
    const categoriaIds: Record<string, string> = {};
    for (const cat of seedCategorias) {
      const [categoria] = await app.db
        .insert(schema.categorias)
        .values({
          nome: cat.nome,
          descricao: cat.descricao,
        })
        .returning();
      categoriaIds[cat.nome] = categoria.id;
    }
    app.logger.info("Categorias seeded successfully");

    // Seed pratos
    app.logger.info("Seeding pratos");
    for (const prato of seedPratos) {
      await app.db.insert(schema.pratos).values({
        nome: prato.nome,
        descricao: prato.descricao,
        preco: prato.preco,
        categoriaId: categoriaIds[prato.categoria],
        imagemUrl: prato.imagemUrl,
        disponivel: true,
      });
    }
    app.logger.info("Pratos seeded successfully");

    // Seed usuarios
    app.logger.info("Seeding usuarios");
    for (const usuario of seedUsuarios) {
      const existing = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.email, usuario.email))
        .limit(1);

      if (existing.length === 0) {
        const hashedPassword = await bcrypt.hash(usuario.password, 10);
        await app.db.insert(schema.usuarios).values({
          nome: usuario.nome,
          email: usuario.email,
          senhaHash: hashedPassword,
          role: usuario.role,
        });
      }
    }
    app.logger.info("Usuarios seeded successfully");

    app.logger.info("Database seeded successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to seed database");
  }
}
