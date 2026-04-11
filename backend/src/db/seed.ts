import { eq, sql } from "drizzle-orm";
import * as schema from "./schema/schema.js";
import { user as userTable } from "./schema/auth-schema.js";
import type { App } from "../index.js";

export async function seedDatabase(app: App) {
  try {
    // Check if categories already exist
    const existingCategories = await app.db.select({ id: schema.categories.id }).from(schema.categories).limit(1);

    if (existingCategories.length > 0) {
      app.logger.info("Database already seeded");
      return;
    }

    app.logger.info("Starting database seed");

    // Seed categories
    const categoryIds = await app.db
      .insert(schema.categories)
      .values([
        {
          name: "Entradas",
          description: "Entradas e aperitivos",
          color: "#F97316",
          icon: "salad",
          active: true,
        },
        {
          name: "Pratos Principais",
          description: "Pratos principais do cardápio",
          color: "#EF4444",
          icon: "utensils",
          active: true,
        },
        {
          name: "Massas",
          description: "Massas artesanais",
          color: "#F59E0B",
          icon: "pasta",
          active: true,
        },
        {
          name: "Sobremesas",
          description: "Sobremesas e doces",
          color: "#EC4899",
          icon: "cake",
          active: true,
        },
        {
          name: "Bebidas",
          description: "Bebidas e sucos",
          color: "#3B82F6",
          icon: "glass",
          active: true,
        },
        {
          name: "Porções",
          description: "Porções para compartilhar",
          color: "#8B5CF6",
          icon: "share",
          active: true,
        },
      ])
      .returning({ id: schema.categories.id });

    const categoryMap: Record<string, string> = {
      Entradas: categoryIds[0].id,
      "Pratos Principais": categoryIds[1].id,
      Massas: categoryIds[2].id,
      Sobremesas: categoryIds[3].id,
      Bebidas: categoryIds[4].id,
      Porções: categoryIds[5].id,
    };

    // Seed dishes
    const dishData = [
      {
        name: "Bruschetta ao Tomate",
        description: "Pão italiano tostado com tomate fresco e manjericão",
        category: "Entradas",
        price: "28.00",
        imageUrl: "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400",
        prepTimeMinutes: 10,
      },
      {
        name: "Carpaccio de Filé",
        description: "Filé mignon fatiado fino com alcaparras e parmesão",
        category: "Entradas",
        price: "45.00",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400",
        prepTimeMinutes: 15,
      },
      {
        name: "Filé Mignon ao Molho Madeira",
        description: "Filé mignon grelhado com molho madeira e legumes",
        category: "Pratos Principais",
        price: "89.00",
        imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400",
        prepTimeMinutes: 30,
      },
      {
        name: "Salmão Grelhado",
        description: "Salmão grelhado com ervas finas e limão siciliano",
        category: "Pratos Principais",
        price: "79.00",
        imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400",
        prepTimeMinutes: 25,
      },
      {
        name: "Frango à Parmegiana",
        description: "Frango empanado com molho de tomate e queijo gratinado",
        category: "Pratos Principais",
        price: "62.00",
        imageUrl: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=400",
        prepTimeMinutes: 25,
      },
      {
        name: "Risoto de Camarão",
        description: "Risoto cremoso com camarões frescos e ervas",
        category: "Pratos Principais",
        price: "85.00",
        imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400",
        prepTimeMinutes: 35,
      },
      {
        name: "Fettuccine Carbonara",
        description: "Fettuccine com bacon, ovos e parmesão",
        category: "Massas",
        price: "52.00",
        imageUrl: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=400",
        prepTimeMinutes: 20,
      },
      {
        name: "Penne ao Pesto",
        description: "Penne com molho pesto de manjericão e pinoli",
        category: "Massas",
        price: "48.00",
        imageUrl: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=400",
        prepTimeMinutes: 18,
      },
      {
        name: "Petit Gateau",
        description: "Bolinho de chocolate quente com sorvete de baunilha",
        category: "Sobremesas",
        price: "32.00",
        imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400",
        prepTimeMinutes: 15,
      },
      {
        name: "Tiramisù",
        description: "Clássico italiano com mascarpone e café",
        category: "Sobremesas",
        price: "28.00",
        imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400",
        prepTimeMinutes: 5,
      },
      {
        name: "Água Mineral",
        description: "Água mineral com ou sem gás 500ml",
        category: "Bebidas",
        price: "8.00",
        imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400",
        prepTimeMinutes: 2,
      },
      {
        name: "Suco Natural",
        description: "Suco natural de frutas da estação",
        category: "Bebidas",
        price: "18.00",
        imageUrl: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400",
        prepTimeMinutes: 5,
      },
      {
        name: "Refrigerante",
        description: "Refrigerante lata 350ml",
        category: "Bebidas",
        price: "12.00",
        imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400",
        prepTimeMinutes: 2,
      },
      {
        name: "Porção de Batata Frita",
        description: "Batata frita crocante com molho especial",
        category: "Porções",
        price: "35.00",
        imageUrl: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400",
        prepTimeMinutes: 20,
      },
      {
        name: "Porção de Polenta Frita",
        description: "Polenta frita crocante com molho de queijo",
        category: "Porções",
        price: "32.00",
        imageUrl: "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400",
        prepTimeMinutes: 20,
      },
    ];

    const dishes = await app.db
      .insert(schema.dishes)
      .values(
        dishData.map((d) => ({
          name: d.name,
          description: d.description,
          categoryId: categoryMap[d.category],
          price: d.price,
          imageUrl: d.imageUrl,
          prepTimeMinutes: d.prepTimeMinutes,
          active: true,
        }))
      )
      .returning({ id: schema.dishes.id });

    // Seed tables
    const tables = [];
    for (let i = 1; i <= 12; i++) {
      const location = i <= 8 ? "salão" : i <= 10 ? "varanda" : "bar";
      const capacity = i <= 8 ? 4 : i <= 10 ? 6 : 2;
      tables.push({ number: i, capacity, location, status: "livre" as const });
    }

    const tableIds = await app.db
      .insert(schema.tables)
      .values(tables)
      .returning({ id: schema.tables.id });

    const tableMap: Record<number, string> = {};
    for (let i = 1; i <= 12; i++) {
      tableMap[i] = tableIds[i - 1].id;
    }

    // Create users with auth API
    const users = [
      {
        email: "admin@cozinhafast.com",
        password: "Admin@123",
        name: "Carlos Admin",
        role: "administrador",
      },
      {
        email: "gerente@cozinhafast.com",
        password: "Gerente@123",
        name: "Ana Gerente",
        role: "gerente",
      },
      {
        email: "garcom1@cozinhafast.com",
        password: "Garcom@123",
        name: "João Garçom",
        role: "garcom",
      },
      {
        email: "garcom2@cozinhafast.com",
        password: "Garcom@123",
        name: "Maria Garçom",
        role: "garcom",
      },
      {
        email: "cozinheiro@cozinhafast.com",
        password: "Cozinha@123",
        name: "Pedro Cozinheiro",
        role: "cozinheiro",
      },
    ];

    const userIds: Record<string, string> = {};
    for (const userData of users) {
      try {
        const result = await app.auth.api.signUpEmail({
          body: {
            email: userData.email,
            password: userData.password,
            name: userData.name,
          },
        });

        // Update user role
        const currentUser = result.user;
        if (currentUser) {
          await app.db
            .update(userTable)
            .set({ role: userData.role as any })
            .where(eq(userTable.id, currentUser.id));
          userIds[userData.name] = currentUser.id;
        }
      } catch (e) {
        // User might already exist
        const existing = await app.db.query.user.findFirst({
          where: eq(userTable.email, userData.email),
        });
        if (existing) {
          userIds[userData.name] = existing.id;
          // Update role if needed
          if (existing.role !== userData.role) {
            await app.db
              .update(userTable)
              .set({ role: userData.role as any })
              .where(eq(userTable.id, existing.id));
          }
        }
      }
    }

    // Create sample orders
    const orderData = [
      {
        tableNumber: 3,
        waiterName: "João Garçom",
        customerCount: 2,
        items: [
          { dishName: "Bruschetta ao Tomate", quantity: 2, status: "em_preparo" },
          { dishName: "Filé Mignon ao Molho Madeira", quantity: 2, status: "pendente" },
        ],
      },
      {
        tableNumber: 5,
        waiterName: "Maria Garçom",
        customerCount: 3,
        items: [
          { dishName: "Salmão Grelhado", quantity: 1, status: "recebido" },
          { dishName: "Fettuccine Carbonara", quantity: 2, status: "pendente" },
          { dishName: "Suco Natural", quantity: 3, status: "entregue" },
        ],
      },
      {
        tableNumber: 7,
        waiterName: "João Garçom",
        customerCount: 1,
        items: [{ dishName: "Petit Gateau", quantity: 1, status: "pronto" }],
      },
    ];

    for (const orderInfo of orderData) {
      const waiterId = userIds[orderInfo.waiterName];
      if (!waiterId) continue;

      const order = await app.db
        .insert(schema.orders)
        .values({
          tableId: tableMap[orderInfo.tableNumber],
          waiterId: waiterId,
          status: "aberta",
          customerCount: orderInfo.customerCount,
        })
        .returning({ id: schema.orders.id });

      if (order.length === 0) continue;

      const orderId = order[0].id;

      // Update table status to ocupada
      await app.db
        .update(schema.tables)
        .set({ status: "ocupada" })
        .where(eq(schema.tables.number, orderInfo.tableNumber));

      // Add items to order
      let totalAmount = 0;
      for (const itemInfo of orderInfo.items) {
        const dish = dishData.find((d) => d.name === itemInfo.dishName);
        if (!dish) continue;

        const itemAmount = parseFloat(dish.price) * itemInfo.quantity;
        totalAmount += itemAmount;

        await app.db.insert(schema.orderItems).values({
          orderId: orderId,
          dishId: dishes.find((d) => d.id)?.id,
          quantity: itemInfo.quantity,
          unitPrice: dish.price,
          status: itemInfo.status as any,
        });
      }

      // Update order total
      await app.db.update(schema.orders).set({ totalAmount: totalAmount.toString() }).where(eq(schema.orders.id, orderId));
    }

    app.logger.info("Database seeded successfully");
  } catch (error) {
    app.logger.error({ err: error }, "Failed to seed database");
  }
}
