import { eq, and } from "drizzle-orm";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { App } from "../index.js";
import * as schema from "../db/schema/schema.js";

export function registerCardapioPublicoRoutes(app: App) {
  const db = app.db as any;

  // GET /api/public/cardapio/:restauranteId — cardápio público (sem auth)
  app.fastify.get<{ Params: { restauranteId: string } }>(
    "/api/public/cardapio/:restauranteId",
    async (request: FastifyRequest<{ Params: { restauranteId: string } }>, reply: FastifyReply) => {
      try {
        const { restauranteId } = request.params;
        const [rest] = await db.select({ id: schema.restaurante.id, nome: schema.restaurante.nome }).from(schema.restaurante).where(eq(schema.restaurante.id, restauranteId));
        if (!rest) return reply.code(404).send({ error: "Restaurante não encontrado" });

        const categorias = await db.select().from(schema.categorias).where(eq(schema.categorias.restauranteId, restauranteId));
        const pratos = await db.select().from(schema.pratos).where(and(eq(schema.pratos.restauranteId, restauranteId), eq(schema.pratos.disponivel, true)));

        const cardapio = categorias.map((cat: any) => ({
          categoria: { id: cat.id, nome: cat.nome },
          pratos: pratos.filter((p: any) => p.categoriaId === cat.id).map((p: any) => ({
            id: p.id, nome: p.nome, descricao: p.descricao, preco: parseFloat(p.preco), imagemUrl: p.imagemUrl,
          })),
        })).filter((c: any) => c.pratos.length > 0);

        const pratosSeemCategoria = pratos.filter((p: any) => !p.categoriaId || !categorias.find((c: any) => c.id === p.categoriaId));
        if (pratosSeemCategoria.length > 0) {
          cardapio.push({ categoria: { id: "outros", nome: "Outros" }, pratos: pratosSeemCategoria.map((p: any) => ({ id: p.id, nome: p.nome, descricao: p.descricao, preco: parseFloat(p.preco), imagemUrl: p.imagemUrl })) });
        }

        return reply.code(200).send({ restaurante: rest, cardapio });
      } catch (err) {
        return reply.code(500).send({ error: "Erro interno" });
      }
    }
  );

  // POST /api/public/pedido — cliente faz pedido pelo QR Code (sem auth)
  app.fastify.post<{ Body: { restaurante_id: string; mesa_numero: number; cliente_nome?: string; itens: Array<{ prato_id: string; quantidade: number; observacao?: string }> } }>(
    "/api/public/pedido",
    async (request: FastifyRequest<{ Body: { restaurante_id: string; mesa_numero: number; cliente_nome?: string; itens: Array<{ prato_id: string; quantidade: number; observacao?: string }> } }>, reply: FastifyReply) => {
      try {
        const { restaurante_id, mesa_numero, cliente_nome, itens } = request.body;
        if (!restaurante_id || !mesa_numero || !itens || itens.length === 0) {
          return reply.code(400).send({ error: "restaurante_id, mesa_numero e itens são obrigatórios" });
        }

        const [rest] = await db.select({ id: schema.restaurante.id }).from(schema.restaurante).where(eq(schema.restaurante.id, restaurante_id));
        if (!rest) return reply.code(404).send({ error: "Restaurante não encontrado" });

        const [mesa] = await db.select().from(schema.mesas).where(and(eq(schema.mesas.numero, mesa_numero), eq(schema.mesas.restauranteId, restaurante_id)));
        if (!mesa) return reply.code(404).send({ error: "Mesa não encontrada" });

        const result = await (db as any).transaction(async (tx: any) => {
          let subtotal = 0;
          const itensPedido: any[] = [];
          for (const item of itens) {
            const [prato] = await tx.select({ id: schema.pratos.id, preco: schema.pratos.preco, nome: schema.pratos.nome }).from(schema.pratos).where(and(eq(schema.pratos.id, item.prato_id), eq(schema.pratos.restauranteId, restaurante_id)));
            if (!prato) return { error: "Prato não encontrado: " + item.prato_id };
            const preco = parseFloat(prato.preco);
            subtotal += preco * item.quantidade;
            itensPedido.push({ pratoId: item.prato_id, quantidade: item.quantidade, precoUnitario: prato.preco, observacao: item.observacao || null });
          }

          // Buscar comanda aberta da mesa ou criar nova
          let comanda;
          const [comandaExistente] = await tx.select().from(schema.comandas).where(and(eq(schema.comandas.mesaId, mesa.id), eq(schema.comandas.status, "aberta"), eq(schema.comandas.restauranteId, restaurante_id)));

          if (comandaExistente) {
            comanda = comandaExistente;
            const novoSubtotal = parseFloat(comanda.subtotal || comanda.total || "0") + subtotal;
            await tx.update(schema.comandas).set({ subtotal: novoSubtotal.toString(), total: novoSubtotal.toString() }).where(eq(schema.comandas.id, comanda.id));
          } else {
            [comanda] = await tx.insert(schema.comandas).values({
              tipo: "mesa", mesaId: mesa.id, mesaNumero: mesa_numero, status: "aberta",
              clienteNome: cliente_nome || "Cliente QR", subtotal: subtotal.toString(), total: subtotal.toString(), restauranteId: restaurante_id,
            }).returning();
            await tx.update(schema.mesas).set({ status: "ocupada" }).where(eq(schema.mesas.id, mesa.id));
          }

          for (const item of itensPedido) {
            await tx.insert(schema.pedidos).values({
              comandaId: comanda.id, pratoId: item.pratoId, quantidade: item.quantidade,
              precoUnitario: item.precoUnitario, observacao: item.observacao, status: "pendente", restauranteId: restaurante_id,
            });
          }

          return { comanda_id: comanda.id, mesa: mesa_numero, itens_adicionados: itensPedido.length, subtotal_adicionado: subtotal };
        });

        if (result.error) return reply.code(400).send({ error: result.error });
        return reply.code(201).send({ success: true, ...result, mensagem: "Pedido recebido! A cozinha já está preparando." });
      } catch (err) {
        app.logger.error({ error: (err as any).message }, "Erro no pedido público");
        return reply.code(500).send({ error: "Erro interno" });
      }
    }
  );

  // GET /api/public/mesa/:restauranteId/:mesaNumero — status da mesa (sem auth)
  app.fastify.get<{ Params: { restauranteId: string; mesaNumero: string } }>(
    "/api/public/mesa/:restauranteId/:mesaNumero",
    async (request: FastifyRequest<{ Params: { restauranteId: string; mesaNumero: string } }>, reply: FastifyReply) => {
      try {
        const { restauranteId, mesaNumero } = request.params;
        const [mesa] = await db.select().from(schema.mesas).where(and(eq(schema.mesas.numero, parseInt(mesaNumero)), eq(schema.mesas.restauranteId, restauranteId)));
        if (!mesa) return reply.code(404).send({ error: "Mesa não encontrada" });

        let comanda = null;
        let pedidos: any[] = [];
        const [comandaAberta] = await db.select().from(schema.comandas).where(and(eq(schema.comandas.mesaId, mesa.id), eq(schema.comandas.status, "aberta")));
        if (comandaAberta) {
          comanda = comandaAberta;
          pedidos = await db.select({ id: schema.pedidos.id, quantidade: schema.pedidos.quantidade, precoUnitario: schema.pedidos.precoUnitario, status: schema.pedidos.status, pratoNome: schema.pratos.nome }).from(schema.pedidos).leftJoin(schema.pratos, eq(schema.pedidos.pratoId, schema.pratos.id)).where(eq(schema.pedidos.comandaId, comandaAberta.id));
        }

        return reply.code(200).send({ mesa: { numero: mesa.numero, status: mesa.status }, comanda, pedidos });
      } catch (err) {
        return reply.code(500).send({ error: "Erro interno" });
      }
    }
  );
}
