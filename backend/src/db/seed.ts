import { eq } from "drizzle-orm";
import * as schema from "./schema/schema.js";
import { user as userTable, account as accountTable } from "./schema/auth-schema.js";
import type { App } from "../index.js";
import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { cleanupTables } from "./cleanup.js";

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
  { nome: "Entradas", descricao: "Aperitivos e entradas leves" },
  { nome: "Pratos Principais", descricao: "Pratos quentes e frios principais" },
  { nome: "Sobremesas", descricao: "Doces e sobremesas variadas" },
  { nome: "Bebidas", descricao: "Bebidas quentes, frias e alcoólicas" },
  { nome: "Lanches", descricao: "Sanduíches, hambúrgueres e lanches rápidos" },
];

const seedPratos = [
  {
    nome: "Bruschetta ao Tomate",
    descricao: "Pão crocante com tomate fresco, alho e manjericão",
    preco: "18.90",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato1/400/300",
  },
  {
    nome: "Carpaccio de Carne",
    descricao: "Carne bovina cortada finíssima com limão e azeite",
    preco: "32.50",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato2/400/300",
  },
  {
    nome: "Filé Mignon ao Molho Madeira",
    descricao: "Filé mignon grelhado com molho madeira de primeira qualidade",
    preco: "68.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato3/400/300",
  },
  {
    nome: "Salmão Grelhado",
    descricao: "Salmão fresco grelhado com temperos aromáticos",
    preco: "72.00",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato4/400/300",
  },
  {
    nome: "Frango à Parmegiana",
    descricao: "Frango à milanesa coberto com molho e queijo derretido",
    preco: "45.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato5/400/300",
  },
  {
    nome: "Risoto de Funghi",
    descricao: "Risoto cremoso com cogumelos frescos e vinho tinto",
    preco: "52.00",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato6/400/300",
  },
  {
    nome: "Petit Gâteau",
    descricao: "Bolo quentinho de chocolate com calda e sorvete de baunilha",
    preco: "22.90",
    categoria: "Sobremesas",
    imagemUrl: "https://picsum.photos/seed/prato7/400/300",
  },
  {
    nome: "Pudim de Leite",
    descricao: "Pudim de leite condensado com calda de caramelo caseira",
    preco: "14.50",
    categoria: "Sobremesas",
    imagemUrl: "https://picsum.photos/seed/prato8/400/300",
  },
  {
    nome: "Suco Natural",
    descricao: "Suco natural de frutas frescas do dia",
    preco: "12.00",
    categoria: "Bebidas",
    imagemUrl: "https://picsum.photos/seed/prato9/400/300",
  },
  {
    nome: "Refrigerante",
    descricao: "Refrigerante gelado em copo com gelo",
    preco: "8.00",
    categoria: "Bebidas",
    imagemUrl: "https://picsum.photos/seed/prato10/400/300",
  },
  {
    nome: "X-Burguer Artesanal",
    descricao: "Hambúrguer artesanal com pão caseiro, queijo e bacon",
    preco: "38.90",
    categoria: "Lanches",
    imagemUrl: "https://picsum.photos/seed/prato11/400/300",
  },
  {
    nome: "Wrap de Frango",
    descricao: "Wrap quente com frango grelhado, alface e molho especial",
    preco: "29.90",
    categoria: "Lanches",
    imagemUrl: "https://picsum.photos/seed/prato12/400/300",
  },
];

const seedUsuarios = [
  { nome: "Administrador", email: "admin@cozinhafast.com", password: "admin123", role: "admin" },
  { nome: "Gerente", email: "gerente@cozinhafast.com", password: "gerente123", role: "gerente" },
  { nome: "Garçom", email: "garcom@cozinhafast.com", password: "garcom123", role: "garcom" },
  { nome: "Cozinheiro", email: "cozinheiro@cozinhafast.com", password: "cozinheiro123", role: "cozinheiro" },
];

export async function cleanupMesasAndComandas(app: App) {
  try {
    app.logger.info("Cleaning up mesas and comandas tables");
    await cleanupTables(app);
  } catch (error) {
    app.logger.error({ err: error }, "Failed to cleanup mesas and comandas");
    throw error;
  }
}

export async function seedDatabase(app: App) {
  try {
    // Check if cleanup-only mode is enabled
    if (process.env.CLEANUP_ONLY === "true") {
      app.logger.info("Running cleanup-only mode - deleting data from mesas and comandas");
      await cleanupTables(app);
      app.logger.info("Cleanup completed - no new data was seeded");
      return;
    }

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

    // Seed mesas (10 tables with different capacidades)
    app.logger.info("Seeding mesas");
    const mesasToSeed = [
      { numero: 1, capacidade: 2 },
      { numero: 2, capacidade: 2 },
      { numero: 3, capacidade: 2 },
      { numero: 4, capacidade: 2 },
      { numero: 5, capacidade: 4 },
      { numero: 6, capacidade: 4 },
      { numero: 7, capacidade: 4 },
      { numero: 8, capacidade: 4 },
      { numero: 9, capacidade: 6 },
      { numero: 10, capacidade: 6 },
    ];
    for (const mesa of mesasToSeed) {
      try {
        const existing = await app.db
          .select()
          .from(schema.mesas)
          .where(eq(schema.mesas.numero, mesa.numero))
          .limit(1);

        if (existing.length === 0) {
          await app.db.insert(schema.mesas).values({
            numero: mesa.numero,
            capacidade: mesa.capacidade,
            status: "livre",
          });
        }
      } catch (err) {
        app.logger.debug({ numero: mesa.numero, err }, "Mesa already exists or error on insert");
      }
    }
    app.logger.info("Mesas seeded successfully");

    // Seed categorias with upsert
    app.logger.info("Seeding categorias");
    const categoriaIds: Record<string, string> = {};
    for (const cat of seedCategorias) {
      try {
        const existing = await app.db
          .select()
          .from(schema.categorias)
          .where(eq(schema.categorias.nome, cat.nome))
          .limit(1);

        if (existing.length > 0) {
          categoriaIds[cat.nome] = existing[0].id;
        } else {
          const [categoria] = await app.db
            .insert(schema.categorias)
            .values({
              nome: cat.nome,
              descricao: cat.descricao,
            })
            .returning();
          categoriaIds[cat.nome] = categoria.id;
        }
      } catch (err) {
        app.logger.warn({ categoria: cat.nome, err }, "Failed to seed categoria");
      }
    }
    app.logger.info("Categorias seeded successfully");

    // Seed pratos with upsert
    app.logger.info("Seeding pratos");
    for (const prato of seedPratos) {
      try {
        const existing = await app.db
          .select()
          .from(schema.pratos)
          .where(eq(schema.pratos.nome, prato.nome))
          .limit(1);

        if (existing.length === 0) {
          await app.db.insert(schema.pratos).values({
            nome: prato.nome,
            descricao: prato.descricao,
            preco: prato.preco,
            categoriaId: categoriaIds[prato.categoria],
            imagemUrl: prato.imagemUrl,
            disponivel: true,
          });
        }
      } catch (err) {
        app.logger.warn({ prato: prato.nome, err }, "Failed to seed prato");
      }
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
