import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  ImageSourcePropType,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Minus, Plus, Trash2, ShoppingCart, UtensilsCrossed } from "lucide-react-native";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { apiGet, apiPost } from "@/utils/api";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiPrato {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagem_url?: string;
  disponivel?: boolean;
  categoria?: { nome: string };
}

interface CartItem {
  prato: ApiPrato;
  quantidade: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function formatPreco(preco: number | string | undefined): string {
  const n = Number(preco);
  if (isNaN(n)) return "R$ --";
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PratoSkeleton() {
  const COLORS = useColors();
  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <SkeletonLine width={64} height={64} borderRadius={10} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLine width={140} height={15} />
        <SkeletonLine width={200} height={12} />
        <SkeletonLine width={70} height={14} />
      </View>
      <SkeletonLine width={90} height={36} borderRadius={20} />
    </View>
  );
}

// ─── Prato Card ───────────────────────────────────────────────────────────────

function PratoCard({
  prato,
  cartQuantidade,
  onAdd,
  index,
}: {
  prato: ApiPrato;
  cartQuantidade: number;
  onAdd: () => void;
  index: number;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const hasImage = !!prato.imagem_url;
  const precoDisplay = formatPreco(prato.preco);
  const descricaoDisplay = prato.descricao || "";
  const inCart = cartQuantidade > 0;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 14,
          marginHorizontal: 16,
          marginBottom: 10,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: inCart ? COLORS.success + "50" : COLORS.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        {/* Thumbnail */}
        {hasImage ? (
          <Image
            source={resolveImageSource(prato.imagem_url)}
            style={{ width: 64, height: 64, borderRadius: 10 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UtensilsCrossed size={24} color={COLORS.textTertiary} />
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text }}
            numberOfLines={1}
          >
            {prato.nome}
          </Text>
          {!!descricaoDisplay && (
            <Text
              style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {descricaoDisplay}
            </Text>
          )}
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: COLORS.success }}>
            {precoDisplay}
          </Text>
        </View>

        {/* Add button */}
        <AnimatedPressable
          onPress={() => {
            console.log("[Cardápio] + Adicionar pressionado:", prato.nome, "id:", prato.id);
            onAdd();
          }}
          style={{
            backgroundColor: COLORS.success,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 9,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          {inCart && (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 10,
                width: 18,
                height: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: COLORS.success }}>
                {cartQuantidade}
              </Text>
            </View>
          )}
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: "#fff" }}>
            {inCart ? "Adicionado" : "+ Adicionar"}
          </Text>
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

// ─── Cart Item Row ─────────────────────────────────────────────────────────────

function CartItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  index,
}: {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  index: number;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: index * 40, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 280, delay: index * 40, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateX]);

  const subtotal = formatPreco(Number(item.prato.preco) * item.quantidade);
  const precoUnit = formatPreco(item.prato.preco);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 14,
          marginHorizontal: 16,
          marginBottom: 10,
          padding: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text
            style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.text, flex: 1, marginRight: 8 }}
            numberOfLines={1}
          >
            {item.prato.nome}
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log("[Carrinho] Remover item pressionado:", item.prato.nome);
              onRemove();
            }}
            style={{ padding: 4 }}
          >
            <Trash2 size={16} color={COLORS.danger} />
          </AnimatedPressable>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {/* Qty controls */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 0,
              backgroundColor: COLORS.surfaceSecondary,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <AnimatedPressable
              onPress={() => {
                console.log("[Carrinho] Decrementar pressionado:", item.prato.nome, "qty atual:", item.quantidade);
                onDecrement();
              }}
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
            >
              <Minus size={14} color={COLORS.text} />
            </AnimatedPressable>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
                color: COLORS.text,
                minWidth: 28,
                textAlign: "center",
              }}
            >
              {item.quantidade}
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log("[Carrinho] Incrementar pressionado:", item.prato.nome, "qty atual:", item.quantidade);
                onIncrement();
              }}
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
            >
              <Plus size={14} color={COLORS.text} />
            </AnimatedPressable>
          </View>

          {/* Price info */}
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
              {precoUnit} cada
            </Text>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.success }}>
              {subtotal}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CardapioNovaComandaScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mesa_id?: string; mesa_numero?: string }>();

  const mesaId = params.mesa_id ?? "";
  const mesaNumero = params.mesa_numero ?? mesaId;

  const [activeTab, setActiveTab] = useState<"cardapio" | "pedido">("cardapio");
  const [pratos, setPratos] = useState<ApiPrato[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch pratos ────────────────────────────────────────────────────────────
  const fetchPratos = useCallback(async () => {
    console.log("[Cardápio] GET /api/pratos");
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiGet<any>("/api/pratos");
      const list: ApiPrato[] = Array.isArray(res) ? res : (res.pratos || []);
      const disponiveis = list.filter((p) => p.disponivel !== false);
      console.log("[Cardápio] Pratos carregados:", disponiveis.length);
      setPratos(disponiveis);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Cardápio] Erro ao carregar pratos:", msg);
      setLoadError("Não foi possível carregar o cardápio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPratos(); }, [fetchPratos]);

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const addToCart = useCallback((prato: ApiPrato) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCart((prev) => {
      const existing = prev.find((c) => c.prato.id === prato.id);
      if (existing) {
        return prev.map((c) => c.prato.id === prato.id ? { ...c, quantidade: c.quantidade + 1 } : c);
      }
      return [...prev, { prato, quantidade: 1 }];
    });
  }, []);

  const incrementItem = useCallback((pratoId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCart((prev) => prev.map((c) => c.prato.id === pratoId ? { ...c, quantidade: c.quantidade + 1 } : c));
  }, []);

  const decrementItem = useCallback((pratoId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCart((prev) => {
      const item = prev.find((c) => c.prato.id === pratoId);
      if (!item) return prev;
      if (item.quantidade <= 1) return prev.filter((c) => c.prato.id !== pratoId);
      return prev.map((c) => c.prato.id === pratoId ? { ...c, quantidade: c.quantidade - 1 } : c);
    });
  }, []);

  const removeItem = useCallback((pratoId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCart((prev) => prev.filter((c) => c.prato.id !== pratoId));
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────────
  const cartCount = cart.reduce((sum, c) => sum + c.quantidade, 0);
  const subtotal = cart.reduce((sum, c) => sum + Number(c.prato.preco) * c.quantidade, 0);
  const subtotalDisplay = formatPreco(subtotal);
  const titleText = `Comanda — Mesa ${mesaNumero}`;

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert("Carrinho vazio", "Adicione pelo menos um item antes de enviar.");
      return;
    }
    if (!mesaId) {
      Alert.alert("Erro", "Mesa não identificada. Volte e tente novamente.");
      return;
    }

    console.log("[Cardápio] Salvar e Enviar Pedido pressionado — mesa:", mesaId, "itens:", cart.length);
    setSubmitting(true);

    try {
      // Step 1: open comanda
      console.log("[Cardápio] POST /api/comandas — mesa_id:", mesaId);
      const comandaRes = await apiPost<any>("/api/comandas", { mesa_id: mesaId });
      const comandaId = comandaRes?.comanda?.id || comandaRes?.id;
      console.log("[Cardápio] Comanda criada, id:", comandaId);

      if (!comandaId) {
        throw new Error("Comanda criada mas sem ID na resposta.");
      }

      // Step 2: send items
      const items = cart.map((c) => ({
        prato_id: c.prato.id,
        quantidade: c.quantidade,
        preco_unitario: Number(c.prato.preco),
      }));
      console.log("[Cardápio] POST /api/comandas/" + comandaId + "/pedidos — items:", items.length);
      await apiPost<any>(`/api/comandas/${comandaId}/pedidos`, { items });
      console.log("[Cardápio] Pedido enviado com sucesso para comanda:", comandaId);

      Alert.alert(
        "Pedido enviado!",
        "O pedido foi enviado para a cozinha com sucesso.",
        [{ text: "OK", onPress: () => { console.log("[Cardápio] Navegar de volta após sucesso"); router.back(); } }]
      );
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Cardápio] Erro ao enviar pedido:", msg);
      Alert.alert("Erro ao enviar pedido", msg || "Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Bottom button height ─────────────────────────────────────────────────────
  const bottomButtonHeight = 56;
  const bottomButtonBottom = insets.bottom + 80; // above FloatingTabBar (~60) + padding
  const scrollPaddingBottom = bottomButtonBottom + bottomButtonHeight + 16;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top", "left", "right"]}>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 56,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: COLORS.surface,
        }}
      >
        <AnimatedPressable
          onPress={() => { console.log("[Cardápio] Botão Voltar pressionado"); router.back(); }}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingRight: 8, zIndex: 1 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.primary }}>
            Voltar
          </Text>
        </AnimatedPressable>

        <Text
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "Outfit_700Bold",
            fontSize: 17,
            color: COLORS.text,
            height: 56,
            lineHeight: 56,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {titleText}
        </Text>

        {/* Cart badge */}
        {cartCount > 0 && (
          <View style={{ position: "absolute", right: 16, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                backgroundColor: COLORS.success,
                borderRadius: 14,
                paddingHorizontal: 10,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ShoppingCart size={13} color="#fff" />
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 12, color: "#fff" }}>
                {cartCount}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Tabs ── */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          paddingHorizontal: 16,
        }}
      >
        {(["cardapio", "pedido"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "cardapio" ? "Cardápio" : "Meu Pedido";
          const showBadge = tab === "pedido" && cartCount > 0;
          return (
            <AnimatedPressable
              key={tab}
              onPress={() => {
                console.log("[Cardápio] Tab selecionada:", tab);
                setActiveTab(tab);
              }}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 4,
                marginRight: 24,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? COLORS.primary : "transparent",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: isActive ? "Outfit_700Bold" : "Outfit_400Regular",
                  fontSize: 15,
                  color: isActive ? COLORS.primary : COLORS.textSecondary,
                }}
              >
                {label}
              </Text>
              {showBadge && (
                <View
                  style={{
                    backgroundColor: COLORS.success,
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 10, color: "#fff" }}>
                    {cartCount}
                  </Text>
                </View>
              )}
            </AnimatedPressable>
          );
        })}
      </View>

      {/* ── Content ── */}
      <View style={{ flex: 1 }}>
        {activeTab === "cardapio" ? (
          // ── Cardápio Tab ──
          loading ? (
            <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: scrollPaddingBottom }}>
              {[0, 1, 2, 3, 4].map((i) => <PratoSkeleton key={i} />)}
            </ScrollView>
          ) : loadError ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  backgroundColor: "rgba(239,68,68,0.10)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="alert-circle-outline" size={34} color={COLORS.danger} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text, textAlign: "center" }}>
                Erro ao carregar cardápio
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 }}>
                {loadError}
              </Text>
              <AnimatedPressable
                onPress={() => { console.log("[Cardápio] Tentar novamente pressionado"); fetchPratos(); }}
                style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 }}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
                  Tentar novamente
                </Text>
              </AnimatedPressable>
            </View>
          ) : pratos.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UtensilsCrossed size={36} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 18, color: COLORS.text, textAlign: "center" }}>
                Nenhum prato disponível
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 21 }}>
                O cardápio está vazio no momento
              </Text>
            </View>
          ) : (
            <FlatList
              data={pratos}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: scrollPaddingBottom }}
              renderItem={({ item, index }) => {
                const cartItem = cart.find((c) => c.prato.id === item.id);
                const qty = cartItem?.quantidade ?? 0;
                return (
                  <PratoCard
                    prato={item}
                    cartQuantidade={qty}
                    onAdd={() => addToCart(item)}
                    index={index}
                  />
                );
              }}
            />
          )
        ) : (
          // ── Meu Pedido Tab ──
          cart.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShoppingCart size={36} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 18, color: COLORS.text, textAlign: "center" }}>
                Carrinho vazio
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 21 }}>
                Adicione pratos do cardápio para montar o pedido
              </Text>
              <AnimatedPressable
                onPress={() => { console.log("[Carrinho] Ir para cardápio pressionado"); setActiveTab("cardapio"); }}
                style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.primary + "30" }}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.primary }}>
                  Ver cardápio
                </Text>
              </AnimatedPressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: scrollPaddingBottom }}>
              {cart.map((item, index) => (
                <CartItemRow
                  key={item.prato.id}
                  item={item}
                  index={index}
                  onIncrement={() => incrementItem(item.prato.id)}
                  onDecrement={() => decrementItem(item.prato.id)}
                  onRemove={() => removeItem(item.prato.id)}
                />
              ))}

              {/* Subtotal card */}
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 8,
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
                    Subtotal
                  </Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textTertiary, marginTop: 2 }}>
                    {cartCount} {cartCount === 1 ? "item" : "itens"}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: COLORS.success, letterSpacing: -0.3 }}>
                  {subtotalDisplay}
                </Text>
              </View>
            </ScrollView>
          )
        )}
      </View>

      {/* ── Fixed bottom button ── */}
      <View
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: bottomButtonBottom,
        }}
      >
        <AnimatedPressable
          onPress={() => {
            console.log("[Cardápio] Salvar e Enviar Pedido pressionado — cart items:", cart.length, "total:", subtotalDisplay);
            handleSubmit();
          }}
          disabled={submitting || cart.length === 0}
          style={{
            backgroundColor: cart.length === 0 ? COLORS.textTertiary : COLORS.success,
            borderRadius: 14,
            height: bottomButtonHeight,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: COLORS.success,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: cart.length === 0 ? 0 : 0.3,
            shadowRadius: 8,
            elevation: 4,
            flexDirection: "row",
            gap: 8,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {cart.length > 0 && <ShoppingCart size={18} color="#fff" />}
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                {cart.length === 0 ? "Adicione itens ao pedido" : "Salvar e Enviar Pedido"}
              </Text>
            </>
          )}
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}
