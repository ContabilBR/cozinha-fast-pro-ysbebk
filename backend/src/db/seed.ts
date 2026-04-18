import { eq } from "drizzle-orm";
import * as schema from "./schema/schema.js";
import { user as userTable, account as accountTable, session as sessionTable, verification as verificationTable } from "./schema/auth-schema.js";
import type { App } from "../index.js";
import { randomUUID } from "crypto";
import * as bcryptjs from "bcryptjs";
import { cleanupTables } from "./cleanup.js";

const seedAuthUsers = [
  {
    name: "Administrador",
    email: "admin@cozinhafast.com",
    password: "123456",
    role: "administrador",
  },
  {
    name: "Gerente",
    email: "gerente@cozinhafast.com",
    password: "123456",
    role: "gerente",
  },
  {
    name: "Gerente Teste",
    email: "gerente@teste.com",
    password: "123456",
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
  { nome: "Administrador", email: "admin@cozinhafast.com", password: "admin123", role: "administrador" },
  { nome: "Gerente", email: "gerente@cozinhafast.com", password: "123456", role: "gerente" },
  { nome: "Gerente Teste", email: "gerente@teste.com", password: "123456", role: "gerente" },
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

// Seed 4 core users that must always exist - using raw database inserts only
const coreUsers = [
  { email: "admin@cozinhafast.com", name: "Administrador", role: "administrador", password: "123456" },
  { email: "gerente@cozinhafast.com", name: "Gerente", role: "gerente", password: "123456" },
  { email: "garcom@cozinhafast.com", name: "Garçom", role: "garcom", password: "123456" },
  { email: "cozinheiro@cozinhafast.com", name: "Cozinheiro", role: "cozinheiro", password: "123456" },
];

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

    // Step 1: Seed 4 core users using raw database inserts (idempotent)
    app.logger.info("Seeding core users with raw database inserts");
    const now = new Date();

    for (const user of coreUsers) {
      try {
        app.logger.info({ email: user.email }, "Processing core user");

        // Check if user exists by email
        const existingUser = await app.db
          .select()
          .from(userTable)
          .where(eq(userTable.email, user.email))
          .limit(1);

        let userId: string;

        if (existingUser.length === 0) {
          // User doesn't exist, create new user
          userId = randomUUID();
          app.logger.info({ email: user.email, userId }, "Inserting new user");

          await app.db.insert(userTable).values({
            id: userId,
            name: user.name,
            email: user.email,
            emailVerified: true,
            role: user.role as any,
            active: true,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          // User exists, use existing ID and update role if needed
          userId = existingUser[0].id;
          app.logger.info({ email: user.email, userId }, "User already exists");

          if (existingUser[0].role !== user.role) {
            await app.db
              .update(userTable)
              .set({ role: user.role as any })
              .where(eq(userTable.id, userId));
            app.logger.info({ userId }, "Updated user role");
          }
        }

        // Check if account exists for this user with credential provider
        const existingAccount = await app.db
          .select()
          .from(accountTable)
          .where(eq(accountTable.userId, userId))
          .limit(1);

        if (existingAccount.length === 0) {
          // Account doesn't exist, create it
          const hashedPassword = await bcryptjs.hash(user.password, 10);
          app.logger.info({ userId }, "Inserting new credential account");

          await app.db.insert(accountTable).values({
            id: randomUUID(),
            accountId: user.email,
            providerId: "credential",
            userId: userId,
            password: hashedPassword,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          app.logger.info({ userId }, "Account already exists");
        }

        app.logger.info({ email: user.email, userId }, "Core user processed successfully");
      } catch (err) {
        app.logger.error({ email: user.email, err }, "Failed to seed core user");
        throw err;
      }
    }

    app.logger.info("Core users seeded successfully");

    // Check if already seeded (by checking mesas)
    const existingMesas = await app.db.select().from(schema.mesas).limit(1);
    if (existingMesas.length > 0) {
      app.logger.info("Database already seeded with mesas and other data");
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
        const hashedPassword = await bcryptjs.hash(usuario.password, 10);
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
