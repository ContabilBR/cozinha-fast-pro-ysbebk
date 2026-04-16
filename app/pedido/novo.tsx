import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Prato, Categoria } from "@/types";
import { apiGet, apiPost } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";
import { Plus, Minus, ShoppingCart, ArrowLeft, UtensilsCrossed, Clock } from "lucide-react-native";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

interface CartItem {
  prato: Prato;
  quantidade: number;
  observacoes: string;
}

export default function NovoPedidoScreen() {
  const { comanda_id, mesa_id } = useLocalSearchParams<{ comanda_id: string; mesa_id: string }>();
  const COLORS = useColors();
  const router = useRouter();

  const [step, setStep] = useState<"browse" | "review">("browse");
  const [pratos, setPratos] = useState<Prato[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    console.log("[NovoPedido] Fetching pratos and categorias");
    try {
      const [pratosRes, catRes] = await Promise.all([
        apiGet<any>("/api/pratos"),
        apiGet<any>("/api/categorias"),
      ]);
      const pratoList: Prato[] = Array.isArray(pratosRes) ? pratosRes : (pratosRes.pratos || []);
      const catList: Categoria[] = Array.isArray(catRes) ? catRes : (catRes.categorias || []);
      setPratos(pratoList.filter((p) => p.disponivel));
      setCategorias(catList);
    } catch (e: any) {
      console.error("[NovoPedido] Error:", e);
      setError("Não foi possível carregar o cardápio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addToCart = (prato: Prato) => {
    console.log("[NovoPedido] Add to cart:", prato.nome);
    setCart((prev) => {
      const existing = prev.find((c) => c.prato.id === prato.id);
      if (existing) {
        return prev.map((c) => c.prato.id === prato.id ? { ...c, quantidade: c.quantidade + 1 } : c);
      }
      return [...prev, { prato, quantidade: 1, observacoes: "" }];
    });
  };

  const removeFromCart = (pratoId: string) => {
    console.log("[NovoPedido] Remove from cart:", pratoId);
    setCart((prev) => {
      const existing = prev.find((c) => c.prato.id === pratoId);
      if (existing && existing.quantidade > 1) {
        return prev.map((c) => c.prato.id === pratoId ? { ...c, quantidade: c.quantidade - 1 } : c);
      }
      return prev.filter((c) => c.prato.id !== pratoId);
    });
  };

  const updateObservacoes = (pratoId: string, obs: string) => {
    setCart((prev) => prev.map((c) => c.prato.id === pratoId ? { ...c, observacoes: obs } : c));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    console.log("[NovoPedido] Submit pedido, comanda:", comanda_id, "mesa:", mesa_id, "items:", cart.length);
    setSubmitting(true);
    try {
      const itens = cart.map((c) => ({
        prato_id: c.prato.id,
        quantidade: c.quantidade,
        observacoes: c.observacoes || undefined,
      }));
      const res = await apiPost<any>("/api/pedidos", {
        comanda_id,
        mesa_id,
        itens,
        observacoes: observacoes || undefined,
      });
      console.log("[NovoPedido] Pedido created:", res.pedido?.id || res.id);
      router.back();
    } catch (e: any) {
      console.error("[NovoPedido] Submit error:", e);
      setError("Não foi possível criar o pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPratos = selectedCategoria
    ? pratos.filter((p) => p.categoria_id === selectedCategoria)
    : pratos;

  const cartTotal = cart.reduce((sum, c) => sum + c.prato.preco * c.quantidade, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantidade, 0);

  if (step === "review") {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Revisar Pedido",
            headerTintColor: COLORS.primary,
            headerBackButtonDisplayMode: "minimal",
            headerLeft: () => (
              <AnimatedPressable onPress={() => setStep("browse")} style={{ padding: 8 }}>
                <ArrowLeft size={22} color={COLORS.primary} />
              </AnimatedPressable>
            ),
          }}
        />
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
              Itens do pedido
            </Text>

            {cart.map((item) => (
              <View
                key={item.prato.id}
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text, flex: 1 }}>
                    {item.prato.nome}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <AnimatedPressable
                      onPress={() => removeFromCart(item.prato.id)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: COLORS.surfaceSecondary,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Minus size={14} color={COLORS.text} />
                    </AnimatedPressable>
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.text, minWidth: 20, textAlign: "center" }}>
                      {item.quantidade}
                    </Text>
                    <AnimatedPressable
                      onPress={() => addToCart(item.prato)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: COLORS.primaryMuted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Plus size={14} color={COLORS.primary} />
                    </AnimatedPressable>
                  </View>
                </View>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>
                  {formatCurrency(item.prato.preco * item.quantidade)}
                </Text>
                <TextInput
                  value={item.observacoes}
                  onChangeText={(t) => updateObservacoes(item.prato.id, t)}
                  placeholder="Observações (opcional)"
                  placeholderTextColor={COLORS.textTertiary}
                  style={{
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 10,
                    padding: 10,
                    fontFamily: "Outfit_400Regular",
                    fontSize: 13,
                    color: COLORS.text,
                  }}
                />
              </View>
            ))}

            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                Observações gerais
              </Text>
              <TextInput
                value={observacoes}
                onChangeText={setObservacoes}
                placeholder="Observações para o pedido inteiro (opcional)"
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 12,
                  padding: 12,
                  fontFamily: "Outfit_400Regular",
                  fontSize: 14,
                  color: COLORS.text,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
              />
            </View>

            {error ? (
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.danger, textAlign: "center" }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: 16,
              backgroundColor: COLORS.surface,
              borderTopWidth: 1,
              borderTopColor: COLORS.border,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                Total estimado
              </Text>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.primary }}>
                {formatCurrency(cartTotal)}
              </Text>
            </View>
            <AnimatedPressable
              onPress={handleSubmit}
              disabled={submitting || cart.length === 0}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                  Enviar pedido
                </Text>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Novo Pedido",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {/* Category filter */}
        <View style={{ backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, padding: 12 }}
          >
            <AnimatedPressable
              onPress={() => setSelectedCategoria(null)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: !selectedCategoria ? COLORS.primary : COLORS.surfaceSecondary,
              }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: !selectedCategoria ? "#fff" : COLORS.textSecondary }}>
                Todos
              </Text>
            </AnimatedPressable>
            {categorias.map((cat) => (
              <AnimatedPressable
                key={cat.id}
                onPress={() => setSelectedCategoria(cat.id === selectedCategoria ? null : cat.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: selectedCategoria === cat.id ? COLORS.primary : COLORS.surfaceSecondary,
                }}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: selectedCategoria === cat.id ? "#fff" : COLORS.textSecondary }}>
                  {cat.nome}
                </Text>
              </AnimatedPressable>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : (
          <FlatList
            data={filteredPratos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 120, gap: 10 }}
            renderItem={({ item }) => {
              const cartItem = cart.find((c) => c.prato.id === item.id);
              const qty = cartItem?.quantidade ?? 0;
              const price = formatCurrency(item.preco);
              const imageSource = resolveImageSource(item.imagem_url);

              return (
                <View
                  style={{
                    backgroundColor: COLORS.surface,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: qty > 0 ? COLORS.primary + "40" : COLORS.border,
                    flexDirection: "row",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <View style={{ width: 80, height: 80, backgroundColor: COLORS.surfaceSecondary }}>
                    {item.imagem_url ? (
                      <Image source={imageSource} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <UtensilsCrossed size={22} color={COLORS.textTertiary} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, padding: 12, justifyContent: "space-between" }}>
                    <View>
                      <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                        {item.nome}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: COLORS.primary }}>
                          {price}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <Clock size={11} color={COLORS.textSecondary} />
                          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
                            {item.tempo_preparo}min
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {qty > 0 ? (
                        <>
                          <AnimatedPressable
                            onPress={() => removeFromCart(item.id)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              backgroundColor: COLORS.surfaceSecondary,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Minus size={13} color={COLORS.text} />
                          </AnimatedPressable>
                          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text, minWidth: 18, textAlign: "center" }}>
                            {qty}
                          </Text>
                        </>
                      ) : null}
                      <AnimatedPressable
                        onPress={() => addToCart(item)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          backgroundColor: COLORS.primaryMuted,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Plus size={13} color={COLORS.primary} />
                      </AnimatedPressable>
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
                <UtensilsCrossed size={32} color={COLORS.textTertiary} />
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                  Nenhum prato disponível
                </Text>
              </View>
            }
          />
        )}

        {cartCount > 0 && (
          <View
            style={{
              position: "absolute",
              bottom: 20,
              left: 16,
              right: 16,
            }}
          >
            <AnimatedPressable
              onPress={() => {
                console.log("[NovoPedido] Review cart pressed, items:", cartCount);
                setStep("review");
              }}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 16,
                height: 56,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                boxShadow: "0 4px 16px rgba(232, 82, 26, 0.4)",
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: "#fff" }}>
                  {cartCount}
                </Text>
              </View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                Revisar pedido
              </Text>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: "rgba(255,255,255,0.85)" }}>
                {formatCurrency(cartTotal)}
              </Text>
            </AnimatedPressable>
          </View>
        )}
      </View>
    </>
  );
}
