import { eq, inArray, sql } from "drizzle-orm";
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
  { nome: "Entradas", descricao: "Aperitivos e entradas" },
  { nome: "Pratos Principais", descricao: "Pratos quentes e frios" },
  { nome: "Bebidas", descricao: "Bebidas quentes e frias" },
];

const seedPratos = [
  {
    nome: "Bruschetta Italiana",
    descricao: "Pão crocante com tomate fresco e manjericão",
    preco: "18.90",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato1/400/300",
  },
  {
    nome: "Carpaccio de Carne",
    descricao: "Carne bovina cortada finíssima com limão e azeite",
    preco: "32.00",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato2/400/300",
  },
  {
    nome: "Filé ao Molho Madeira",
    descricao: "Filé mignon grelhado com molho madeira",
    preco: "58.00",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato3/400/300",
  },
  {
    nome: "Risoto de Camarão",
    descricao: "Risoto cremoso com camarões frescos",
    preco: "65.00",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato4/400/300",
  },
  {
    nome: "Suco de Laranja Natural",
    descricao: "Suco natural de laranja fresca",
    preco: "12.00",
    categoria: "Bebidas",
    imagemUrl: "https://picsum.photos/seed/prato5/400/300",
  },
  {
    nome: "Água com Gás",
    descricao: "Água mineral com gás gelada",
    preco: "8.00",
    categoria: "Bebidas",
    imagemUrl: "https://picsum.photos/seed/prato6/400/300",
  },
];

const seedUsuarios = [
  { nome: "João Garçom", email: "garcom@cozinhafast.com", password: "123456", role: "garcom" },
  { nome: "Maria Cozinha", email: "cozinheiro@cozinhafast.com", password: "123456", role: "cozinha" },
  { nome: "Carlos Gerente", email: "gerente@cozinhafast.com", password: "123456", role: "gerente" },
  { nome: "Admin Sistema", email: "admin@cozinhafast.com", password: "123456", role: "admin" },
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
const seedUsers = [
  { email: "admin@cozinhafast.com", name: "Administrador", role: "admin", password: "admin123" },
  { email: "gerente@cozinhafast.com", name: "Gerente", role: "gerente", password: "gerente123" },
  { email: "garcom@cozinhafast.com", name: "Garçom", role: "garcom", password: "garcom123" },
  { email: "cozinheiro@cozinhafast.com", name: "Cozinheiro", role: "cozinheiro", password: "cozinheiro123" },
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

    // Step 1: Ensure all enum values exist using raw SQL
    app.logger.info("Ensuring user_role enum values exist");
    try {
      const enumValues = ["admin", "gerente", "garcom", "cozinheiro", "administrador"];

      for (const value of enumValues) {
        try {
          const query = `
            DO $$
            BEGIN
              ALTER TYPE user_role ADD VALUE IF NOT EXISTS '${value}';
            EXCEPTION WHEN others THEN NULL;
            END$$;
          `;
          // Try to execute raw SQL if the method exists
          if (typeof (app.db as any).execute === 'function') {
            await (app.db as any).execute(query);
          }
        } catch (err) {
          app.logger.debug({ value, err }, "Failed to add enum value (may already exist)");
        }
      }

      app.logger.info("Enum values ensured");
    } catch (err) {
      app.logger.warn({ err }, "Failed to ensure enum values");
    }

    // Step 2: Destructive seed - force recreate the 4 seed users on every startup
    app.logger.info("Destructively seeding the 4 core users");
    const now = new Date();
    const seedEmails = seedUsers.map(u => u.email);

    try {
      // Query for user IDs of the seed emails
      app.logger.info("Finding existing seed user IDs");
      const existingUsers = await app.db
        .select({ id: userTable.id, email: userTable.email })
        .from(userTable)
        .where(inArray(userTable.email, seedEmails));

      const userIdsToDelete = existingUsers.map(u => u.id);

      if (userIdsToDelete.length > 0) {
        app.logger.info({ count: userIdsToDelete.length }, "Deleting existing sessions for seed users");
        // Delete sessions first (FK constraint)
        await app.db
          .delete(sessionTable)
          .where(inArray(sessionTable.userId, userIdsToDelete));

        app.logger.info("Deleting existing accounts for seed users");
        // Delete accounts
        await app.db
          .delete(accountTable)
          .where(inArray(accountTable.userId, userIdsToDelete));

        app.logger.info("Deleting existing seed users");
        // Delete users
        await app.db
          .delete(userTable)
          .where(inArray(userTable.email, seedEmails));
      }

      // Create new users with fresh UUIDs
      app.logger.info("Creating new seed users");
      for (const seedUser of seedUsers) {
        const userId = randomUUID();

        // Insert into user table
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

        app.logger.info({ email: seedUser.email, userId }, "Created seed user");

        // Hash password and insert into account table
        const hashedPassword = bcryptjs.hashSync(seedUser.password, 10);
        const hashPrefix = hashedPassword.substring(0, 10);

        await app.db.insert(accountTable).values({
          id: randomUUID(),
          accountId: seedUser.email,
          providerId: "credential",
          userId: userId,
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        });

        app.logger.info({ email: seedUser.email, hashPrefix }, `Seed user created: ${seedUser.email}`);
      }

      app.logger.info("Core users destructively seeded successfully");
    } catch (err) {
      app.logger.error({ err }, "Failed to destructively seed users");
      throw err;
    }

    // Check if already seeded (by checking mesas)
    const existingMesas = await app.db.select().from(schema.mesas).limit(1);
    if (existingMesas.length > 0) {
      app.logger.info("Database already seeded with mesas and other data");
      return;
    }

    // Seed mesas (10 tables with capacidade 4)
    app.logger.info("Seeding mesas");
    const mesasToSeed = [
      { numero: 1, capacidade: 4 },
      { numero: 2, capacidade: 4 },
      { numero: 3, capacidade: 4 },
      { numero: 4, capacidade: 4 },
      { numero: 5, capacidade: 4 },
      { numero: 6, capacidade: 4 },
      { numero: 7, capacidade: 4 },
      { numero: 8, capacidade: 4 },
      { numero: 9, capacidade: 4 },
      { numero: 10, capacidade: 4 },
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

    // Seed usuarios with pre-computed bcrypt hash
    app.logger.info("Seeding usuarios with pre-computed bcrypt hash");

    // Pre-computed hash of "123456" with bcrypt - NEVER call bcrypt.hash() at runtime for seeding
    const HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhu';

    try {
      // Delete all existing usuarios to ensure fresh seed
      app.logger.info("Clearing existing usuarios for fresh seed");
      try {
        await app.db.delete(schema.usuarios);
        app.logger.info("Existing usuarios cleared");
      } catch (deleteErr) {
        app.logger.warn({ err: deleteErr }, 'Failed to delete existing usuarios (table may not exist yet)');
      }

      // Insert fresh seed usuarios
      app.logger.info("Inserting fresh seed usuarios");
      for (const usuario of seedUsuarios) {
        try {
          await app.db.insert(schema.usuarios).values({
            nome: usuario.nome,
            email: usuario.email,
            senhaHash: HASH,
            role: usuario.role,
          });
          app.logger.info({ email: usuario.email }, 'Usuario inserted successfully');
        } catch (insertErr) {
          app.logger.error({ email: usuario.email, err: insertErr }, 'Failed to insert usuario');
        }
      }

      // Verify: log the stored data for gerente user
      app.logger.info("Verifying seed data");
      const gerenteUsers = await app.db
        .select()
        .from(schema.usuarios)
        .where(eq(schema.usuarios.email, 'gerente@cozinhafast.com'));

      if (gerenteUsers.length > 0) {
        const gerenteUser = gerenteUsers[0];
        app.logger.info(
          {
            id: gerenteUser.id,
            nome: gerenteUser.nome,
            email: gerenteUser.email,
            role: gerenteUser.role,
            senhaHashFull: gerenteUser.senhaHash,
          },
          'Verification: Gerente user stored successfully'
        );
      } else {
        app.logger.warn('Gerente user not found after seeding - seed may have failed');
      }

      // Count total usuarios
      const totalUsuarios = await app.db
        .select()
        .from(schema.usuarios);
      app.logger.info({ count: totalUsuarios.length }, 'Total usuarios in database');

      app.logger.info("Usuarios seeded successfully");
    } catch (err) {
      app.logger.error({ err }, 'Failed to seed usuarios');
    }

    app.logger.info("Database seeded successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to seed database");
  }
}
