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
  { nome: "Entradas", descricao: "Aperitivos e entradas leves" },
  { nome: "Pratos Principais", descricao: "Pratos quentes e frios" },
  { nome: "Sobremesas", descricao: "Doces e sobremesas" },
  { nome: "Bebidas", descricao: "Bebidas quentes e frias" },
];

const seedPratos = [
  {
    nome: "Coxinha de Frango",
    descricao: "Coxinha crocante recheada com frango desfiado",
    preco: "12.90",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato1/400/300",
  },
  {
    nome: "Bolinho de Bacalhau",
    descricao: "Bolinho de bacalhau à Brás, crocante por fora macio por dentro",
    preco: "15.90",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato2/400/300",
  },
  {
    nome: "Pão de Alho",
    descricao: "Pão crocante com azeite e alho",
    preco: "8.90",
    categoria: "Entradas",
    imagemUrl: "https://picsum.photos/seed/prato3/400/300",
  },
  {
    nome: "Frango Grelhado",
    descricao: "Peito de frango grelhado com acompanhamentos",
    preco: "38.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato4/400/300",
  },
  {
    nome: "Picanha na Brasa",
    descricao: "Picanha suculenta grelhada no fogo de chão",
    preco: "65.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato5/400/300",
  },
  {
    nome: "Salmão ao Molho",
    descricao: "Salmão fresco ao molho de limão e manteiga",
    preco: "55.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato6/400/300",
  },
  {
    nome: "Feijoada Completa",
    descricao: "Feijoada tradicional com acompanhamentos",
    preco: "42.90",
    categoria: "Pratos Principais",
    imagemUrl: "https://picsum.photos/seed/prato7/400/300",
  },
  {
    nome: "Pudim de Leite",
    descricao: "Pudim doce de leite condensado",
    preco: "14.90",
    categoria: "Sobremesas",
    imagemUrl: "https://picsum.photos/seed/prato8/400/300",
  },
  {
    nome: "Mousse de Chocolate",
    descricao: "Mousse aerado de chocolate belga",
    preco: "12.90",
    categoria: "Sobremesas",
    imagemUrl: "https://picsum.photos/seed/prato9/400/300",
  },
  {
    nome: "Suco de Laranja Natural",
    descricao: "Suco natural de laranja fresca",
    preco: "9.90",
    categoria: "Bebidas",
    imagemUrl: "https://picsum.photos/seed/prato10/400/300",
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

    // Step 2b: Upsert seed usuarios (preserve existing real user accounts across deploys)
    app.logger.info("Upserting seed usuarios");

    try {
      // Hash password "123456" at runtime
      const senhaHash = bcryptjs.hashSync('123456', 10);
      app.logger.info({ hashLength: senhaHash.length, hashStart: senhaHash.substring(0, 20) }, 'Password hashed for seed');

      // Prepare seed data
      const seedUsuariosData = [
        { nome: 'Administrador', email: 'admin@cozinhafast.com', role: 'admin' },
        { nome: 'Gerente', email: 'gerente@cozinhafast.com', role: 'gerente' },
        { nome: 'Garçom', email: 'garcom@cozinhafast.com', role: 'garcom' },
        { nome: 'Cozinheiro', email: 'cozinheiro@cozinhafast.com', role: 'cozinheiro' },
      ];

      // Upsert each usuario: check if exists by email, only insert if not found
      app.logger.info({ count: seedUsuariosData.length }, "Upserting seed usuarios with INSERT ... ON CONFLICT");

      for (const u of seedUsuariosData) {
        try {
          const existing = await app.db
            .select()
            .from(schema.usuarios)
            .where(eq(schema.usuarios.email, u.email))
            .limit(1);

          if (existing.length === 0) {
            await app.db.insert(schema.usuarios).values({
              nome: u.nome,
              email: u.email,
              senhaHash: senhaHash,
              role: u.role,
            });
            app.logger.debug({ email: u.email }, 'Inserted new seed usuario');
          } else {
            app.logger.debug({ email: u.email }, 'Seed usuario already exists, skipping');
          }
        } catch (err) {
          app.logger.warn({ email: u.email, err }, 'Failed to upsert usuario');
        }
      }

      app.logger.info("Seed usuarios upserted successfully");

      // Verify
      const allUsuarios = await app.db.select().from(schema.usuarios);
      app.logger.info({ count: allUsuarios.length }, 'Usuarios verified');

      allUsuarios.forEach((u, idx) => {
        app.logger.debug({
          index: idx,
          email: u.email,
          hasPassword: !!u.senhaHash,
          hashLength: u.senhaHash?.length || 0
        }, 'Seeded usuario');
      });
    } catch (err) {
      app.logger.error({ err }, 'Failed to upsert seed usuarios');
    }

    // Check if mesas table needs seeding
    const existingMesas = await app.db.select().from(schema.mesas);
    const mesaCount = existingMesas.length;

    app.logger.info({ count: mesaCount }, "Checking mesas table");

    // Only seed/reset if count is outside the valid range (1-25)
    let shouldSeedMesas = false;

    if (mesaCount > 25) {
      app.logger.info("Mesas table bloated (> 25 rows), truncating and re-seeding");
      await app.db.delete(schema.mesas);
      shouldSeedMesas = true;
    } else if (mesaCount === 0) {
      app.logger.info("Mesas table empty, seeding");
      shouldSeedMesas = true;
    } else {
      // Count is between 1-25, already seeded correctly
      app.logger.info({ count: mesaCount }, "Mesas table already seeded correctly, skipping");
      // Skip to remaining seed steps (categorias, pratos)
    }

    if (shouldSeedMesas) {
      // Seed exactly 20 mesas with varied statuses and capacidades
      app.logger.info("Seeding mesas");
      const mesasToSeed = [
        { numero: 1, capacidade: 4, status: "disponivel" as const },
        { numero: 2, capacidade: 4, status: "disponivel" as const },
        { numero: 3, capacidade: 4, status: "disponivel" as const },
        { numero: 4, capacidade: 4, status: "disponivel" as const },
        { numero: 5, capacidade: 4, status: "disponivel" as const },
        { numero: 6, capacidade: 4, status: "disponivel" as const },
        { numero: 7, capacidade: 4, status: "disponivel" as const },
        { numero: 8, capacidade: 4, status: "disponivel" as const },
        { numero: 9, capacidade: 4, status: "disponivel" as const },
        { numero: 10, capacidade: 4, status: "disponivel" as const },
        { numero: 11, capacidade: 6, status: "ocupada" as const },
        { numero: 12, capacidade: 6, status: "ocupada" as const },
        { numero: 13, capacidade: 6, status: "ocupada" as const },
        { numero: 14, capacidade: 6, status: "ocupada" as const },
        { numero: 15, capacidade: 6, status: "ocupada" as const },
        { numero: 16, capacidade: 2, status: "reservada" as const },
        { numero: 17, capacidade: 2, status: "reservada" as const },
        { numero: 18, capacidade: 2, status: "reservada" as const },
        { numero: 19, capacidade: 8, status: "disponivel" as const },
        { numero: 20, capacidade: 8, status: "disponivel" as const },
      ];

      for (const mesa of mesasToSeed) {
        try {
          await app.db.insert(schema.mesas).values({
            numero: mesa.numero,
            capacidade: mesa.capacidade,
            status: mesa.status,
          });
        } catch (err) {
          app.logger.debug({ numero: mesa.numero, err }, "Mesa insert error");
        }
      }
      app.logger.info("Mesas seeded successfully");
    }

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

    app.logger.info("Database seeded successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to seed database");
  }
}
