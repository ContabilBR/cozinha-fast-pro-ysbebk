import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  UIManager,
  ImageSourcePropType,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Minus, Plus, Trash2, ShoppingCart, UtensilsCrossed, ChevronDown } from "lucide-react-native";
import { useColors } from "@/hooks/useColors";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { apiGet, apiPost } from "@/utils/api";

// ─── Mesa type ────────────────────────────────────────────────────────────────

interface ApiMesa {
  id: string;
  numero: number;
  status?: string;
  capacidade?: number;
}

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
  id: string;
  nome: string;
  preco: number;
  imagem_url?: string;
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
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <SkeletonLine width={60} height={60} borderRadius={8} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLine width={140} height={14} />
        <SkeletonLine width={180} height={11} />
        <SkeletonLine width={70} height={13} />
      </View>
      <SkeletonLine width={100} height={36} borderRadius={20} />
    </View>
  );
}

// ─── Prato Card ───────────────────────────────────────────────────────────────

function PratoCard({
  prato,
  cartQuantidade,
  observacao,
  onAdd,
  onObservacaoChange,
  index,
}: {
  prato: ApiPrato;
  cartQuantidade: number;
  observacao: string;
  onAdd: () => void;
  onObservacaoChange: (text: string) => void;
  index: number;
}) {
  const COLORS = useColors();
  const hasImage = !!prato.imagem_url;
  const precoDisplay = formatPreco(prato.preco);
  const descricaoDisplay = prato.descricao || "";
  const inCart = cartQuantidade > 0;
  const buttonLabel = inCart ? "Adicionado" : "+ Adicionar";

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {/* Thumbnail */}
        {hasImage ? (
          <Image
            source={resolveImageSource(prato.imagem_url)}
            style={{ width: 60, height: 60, borderRadius: 8 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 8,
              backgroundColor: "#f0f0f0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UtensilsCrossed size={22} color="#bbb" />
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: "#111" }}
            numberOfLines={1}
          >
            {prato.nome}
          </Text>
          {!!descricaoDisplay && (
            <Text
              style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: "#888", lineHeight: 16 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {descricaoDisplay}
            </Text>
          )}
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: "#22c55e" }}>
            {precoDisplay}
          </Text>
        </View>

        {/* Add button */}
        <Pressable
          onPress={() => {
            console.log("[Cardápio] Botão adicionar pressionado:", prato.nome, "id:", prato.id, "qty atual:", cartQuantidade);
            onAdd();
          }}
          style={({ pressed }) => ({
            backgroundColor: inCart ? "#22c55e" : "transparent",
            borderWidth: inCart ? 0 : 1.5,
            borderColor: "#22c55e",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            opacity: pressed ? 0.75 : 1,
          })}
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
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: "#22c55e" }}>
                {cartQuantidade}
              </Text>
            </View>
          )}
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: inCart ? "#fff" : "#22c55e" }}>
            {buttonLabel}
          </Text>
        </Pressable>
      </View>

      {/* Observation field — only shown when item is in cart */}
      {inCart && (
        <TextInput
          value={observacao}
          onChangeText={(text) => {
            console.log("[Cardápio] Observação alterada para:", prato.nome, "—", text);
            onObservacaoChange(text);
          }}
          placeholder="Observação (ex: sem cebola)"
          placeholderTextColor="#bbb"
          style={{
            marginTop: 10,
            backgroundColor: "#f9f9f9",
            borderWidth: 1,
            borderColor: "#e5e5e5",
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 7,
            fontFamily: "Outfit_400Regular",
            fontSize: 12,
            color: "#444",
          }}
        />
      )}
    </View>
  );
}

// ─── Cart Item Row ─────────────────────────────────────────────────────────────

function CartItemRow({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const subtotalDisplay = formatPreco(Number(item.preco) * item.quantidade);
  const precoUnit = formatPreco(item.preco);

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text
          style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#111", flex: 1, marginRight: 8 }}
          numberOfLines={1}
        >
          {item.nome}
        </Text>
        <Pressable
          onPress={() => {
            console.log("[Carrinho] Remover item pressionado:", item.nome);
            onRemove();
          }}
          style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <Trash2 size={16} color="#ef4444" />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {/* Qty controls */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <Pressable
            onPress={() => {
              console.log("[Carrinho] Decrementar pressionado:", item.nome, "qty atual:", item.quantidade);
              onDecrement();
            }}
            style={({ pressed }) => ({ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Minus size={14} color="#333" />
          </Pressable>
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 15,
              color: "#111",
              minWidth: 28,
              textAlign: "center",
            }}
          >
            {item.quantidade}
          </Text>
          <Pressable
            onPress={() => {
              console.log("[Carrinho] Incrementar pressionado:", item.nome, "qty atual:", item.quantidade);
              onIncrement();
            }}
            style={({ pressed }) => ({ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Plus size={14} color="#333" />
          </Pressable>
        </View>

        {/* Price info */}
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: "#888" }}>
            {precoUnit} cada
          </Text>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: "#22c55e" }}>
            {subtotalDisplay}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Mesa Dropdown ────────────────────────────────────────────────────────────

function MesaDropdown({
  mesas,
  loadingMesas,
  selectedMesaId,
  onSelect,
  error,
}: {
  mesas: ApiMesa[];
  loadingMesas: boolean;
  selectedMesaId: string;
  onSelect: (id: string) => void;
  error: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedMesa = mesas.find((m) => m.id === selectedMesaId);
  const selectedLabel = selectedMesa ? `Mesa ${selectedMesa.numero}` : "Selecionar mesa...";

  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e5e5",
        paddingVertical: 12,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          fontFamily: "Outfit_600SemiBold",
          fontSize: 13,
          color: "#555",
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Selecionar Mesa
      </Text>

      {loadingMesas ? (
        <SkeletonLine width="100%" height={44} borderRadius={10} />
      ) : (
        <Pressable
          onPress={() => {
            console.log("[Comanda] Dropdown de mesa aberto");
            setModalVisible(true);
          }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderWidth: 1.5,
            borderColor: selectedMesaId ? "#22c55e" : "#d1d5db",
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 11,
            backgroundColor: selectedMesaId ? "#f0fdf4" : "#fafafa",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 14,
              color: selectedMesaId ? "#22c55e" : "#aaa",
            }}
          >
            {selectedLabel}
          </Text>
          <ChevronDown size={18} color={selectedMesaId ? "#22c55e" : "#aaa"} />
        </Pressable>
      )}

      {!!error && (
        <Text
          style={{
            fontFamily: "Outfit_400Regular",
            fontSize: 12,
            color: "#ef4444",
            marginTop: 6,
          }}
        >
          {error}
        </Text>
      )}

      {/* Dropdown Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
          onPress={() => {
            console.log("[Comanda] Dropdown de mesa fechado (backdrop)");
            setModalVisible(false);
          }}
        >
          <Pressable
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              width: "85%",
              maxHeight: "60%",
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 10,
            }}
            onPress={() => {}}
          >
            {/* Modal header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: "#f0f0f0",
              }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#111" }}>
                Selecionar Mesa
              </Text>
              <Pressable
                onPress={() => {
                  console.log("[Comanda] Dropdown de mesa fechado (botão X)");
                  setModalVisible(false);
                }}
                style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons name="close" size={20} color="#888" />
              </Pressable>
            </View>

            {/* Mesa list */}
            <ScrollView bounces={false}>
              {mesas.length === 0 ? (
                <View style={{ padding: 24, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: "#888" }}>
                    Nenhuma mesa disponível
                  </Text>
                </View>
              ) : (
                mesas.map((mesa, idx) => {
                  const isSelected = mesa.id === selectedMesaId;
                  const mesaLabel = `Mesa ${mesa.numero}`;
                  const isLast = idx === mesas.length - 1;
                  return (
                    <Pressable
                      key={mesa.id}
                      onPress={() => {
                        console.log("[Comanda] Mesa selecionada no dropdown:", mesa.numero, "id:", mesa.id);
                        onSelect(mesa.id);
                        setModalVisible(false);
                      }}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 18,
                        paddingVertical: 14,
                        backgroundColor: isSelected ? "#f0fdf4" : pressed ? "#f9f9f9" : "#fff",
                        borderBottomWidth: isLast ? 0 : 1,
                        borderBottomColor: "#f5f5f5",
                      })}
                    >
                      <Text
                        style={{
                          fontFamily: isSelected ? "Outfit_700Bold" : "Outfit_400Regular",
                          fontSize: 15,
                          color: isSelected ? "#22c55e" : "#222",
                        }}
                      >
                        {mesaLabel}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#22c55e" />
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CardapioNovaComandaScreen() {
  const router = useRouter();
  const { mesa_id, mesa_numero } = useLocalSearchParams<{ mesa_id: string; mesa_numero: string }>();

  // If mesa_id was passed via params, pre-select it; otherwise let the garçom pick
  const [selectedMesaId, setSelectedMesaId] = useState<string>(mesa_id ?? "");
  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [loadingMesas, setLoadingMesas] = useState(true);
  const [mesaError, setMesaError] = useState("");

  // Observations keyed by prato id
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});

  const selectedMesa = mesas.find((m) => m.id === selectedMesaId);
  const mesaNumeroDisplay = selectedMesa
    ? String(selectedMesa.numero)
    : mesa_numero ?? (selectedMesaId || "—");
  const titleText = selectedMesaId
    ? `Comanda — Mesa ${mesaNumeroDisplay}`
    : "Nova Comanda";

  const [activeTab, setActiveTab] = useState<"cardapio" | "pedido">("cardapio");
  const [pratos, setPratos] = useState<ApiPrato[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch mesas ─────────────────────────────────────────────────────────────
  const fetchMesas = useCallback(async () => {
    console.log("[Comanda] GET /api/mesas");
    setLoadingMesas(true);
    try {
      const res = await apiGet<any>("/api/mesas");
      const list: ApiMesa[] = Array.isArray(res) ? res : (res.mesas ?? []);
      // Only show available mesas (status !== "ocupada" unless it's the pre-selected one)
      const available = list.filter(
        (m) => m.status !== "ocupada" || m.id === (mesa_id ?? "")
      );
      console.log("[Comanda] Mesas disponíveis:", available.length);
      setMesas(available);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Comanda] Erro ao carregar mesas:", msg);
      setMesas([]);
    } finally {
      setLoadingMesas(false);
    }
  }, [mesa_id]);

  useEffect(() => { fetchMesas(); }, [fetchMesas]);

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
    setCart((prev) => {
      const existing = prev.find((c) => c.id === prato.id);
      if (existing) {
        return prev.map((c) => c.id === prato.id ? { ...c, quantidade: c.quantidade + 1 } : c);
      }
      return [...prev, { id: prato.id, nome: prato.nome, preco: Number(prato.preco), imagem_url: prato.imagem_url, quantidade: 1 }];
    });
  }, []);

  const incrementItem = useCallback((id: string) => {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, quantidade: c.quantidade + 1 } : c));
  }, []);

  const decrementItem = useCallback((id: string) => {
    setCart((prev) => {
      const item = prev.find((c) => c.id === id);
      if (!item) return prev;
      if (item.quantidade <= 1) {
        // Clear observation when item removed
        setObservacoes((obs) => {
          const next = { ...obs };
          delete next[id];
          return next;
        });
        return prev.filter((c) => c.id !== id);
      }
      return prev.map((c) => c.id === id ? { ...c, quantidade: c.quantidade - 1 } : c);
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
    setObservacoes((obs) => {
      const next = { ...obs };
      delete next[id];
      return next;
    });
  }, []);

  const setObservacao = useCallback((pratoId: string, text: string) => {
    setObservacoes((prev) => ({ ...prev, [pratoId]: text }));
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────────
  const cartCount = cart.reduce((sum, c) => sum + c.quantidade, 0);
  const subtotal = cart.reduce((sum, c) => sum + c.preco * c.quantidade, 0);
  const subtotalDisplay = formatPreco(subtotal);
  const cartIsEmpty = cart.length === 0;
  const pedidoTabLabel = "Meu Pedido";

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (cart.length === 0) return;
    if (!selectedMesaId) {
      setMesaError("Selecione uma mesa antes de enviar o pedido.");
      console.warn("[Comanda] Tentativa de envio sem mesa selecionada");
      return;
    }
    setMesaError("");

    console.log("[Cardápio] Salvar e Enviar Pedido pressionado — mesa:", selectedMesaId, "itens:", cart.length, "total:", subtotalDisplay);
    setSubmitting(true);

    try {
      // Step 1: Create comanda
      console.log("[Cardápio] POST /api/comandas — mesa_id:", selectedMesaId);
      const comandaData = await apiPost<any>("/api/comandas", { mesa_id: selectedMesaId });
      const comandaId = comandaData?.comanda?.id || comandaData?.id;
      console.log("[Cardápio] Comanda criada, id:", comandaId);

      if (!comandaId) {
        throw new Error("Comanda criada mas sem ID na resposta.");
      }

      // Step 2: Send pedidos with observacao
      const items = cart.map((c) => ({
        prato_id: c.id,
        quantidade: c.quantidade,
        preco_unitario: c.preco,
        observacao: observacoes[c.id] || null,
      }));
      console.log("[Cardápio] POST /api/comandas/" + comandaId + "/pedidos — items:", items.length, JSON.stringify(items));

      await apiPost<any>(`/api/comandas/${comandaId}/pedidos`, { items });

      console.log("[Cardápio] Pedido enviado com sucesso para comanda:", comandaId);
      setCart([]);
      setObservacoes({});
      Alert.alert(
        "✅ Pedido enviado!",
        "Pedido enviado para a cozinha com sucesso.",
        [
          {
            text: "OK",
            onPress: () => {
              console.log("[Cardápio] Navegar para cardápio após sucesso");
              router.replace("/(tabs)/(cardapio)");
            },
          },
        ]
      );
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Cardápio] Erro ao enviar pedido:", msg);
      Alert.alert("Erro", msg || "Não foi possível enviar o pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f8f8" }} edges={["top", "left", "right"]}>

      {/* ── Header ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 56,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: "#e5e5e5",
          backgroundColor: "#fff",
        }}
      >
        <Pressable
          onPress={() => { console.log("[Cardápio] Botão Voltar pressionado"); router.back(); }}
          style={{ flexDirection: "row", alignItems: "center", padding: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color="#22c55e" />
          <Text style={{ color: "#22c55e", marginLeft: 4, fontSize: 16, fontFamily: "Outfit_600SemiBold" }}>
            Voltar
          </Text>
        </Pressable>

        <Text
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "Outfit_700Bold",
            fontSize: 17,
            color: "#111",
            height: 56,
            lineHeight: 56,
          }}
          numberOfLines={1}
          pointerEvents="none"
        >
          {titleText}
        </Text>

        {/* Cart badge */}
        <View style={{ position: "absolute", right: 16, alignItems: "center", justifyContent: "center" }}>
          {cartCount > 0 && (
            <View
              style={{
                backgroundColor: "#22c55e",
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
          )}
        </View>
      </View>

      {/* ── Mesa Dropdown ── */}
      <MesaDropdown
        mesas={mesas}
        loadingMesas={loadingMesas}
        selectedMesaId={selectedMesaId}
        onSelect={(id) => {
          setSelectedMesaId(id);
          setMesaError("");
        }}
        error={mesaError}
      />

      {/* ── Tabs ── */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#e5e5e5",
          paddingHorizontal: 16,
        }}
      >
        {/* Cardápio tab */}
        <Pressable
          onPress={() => { console.log("[Cardápio] Tab Cardápio selecionada"); setActiveTab("cardapio"); }}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 4,
            marginRight: 24,
            borderBottomWidth: 2,
            borderBottomColor: activeTab === "cardapio" ? "#22c55e" : "transparent",
          }}
        >
          <Text
            style={{
              fontFamily: activeTab === "cardapio" ? "Outfit_700Bold" : "Outfit_400Regular",
              fontSize: 15,
              color: activeTab === "cardapio" ? "#22c55e" : "#888",
            }}
          >
            Cardápio
          </Text>
        </Pressable>

        {/* Meu Pedido tab */}
        <Pressable
          onPress={() => { console.log("[Cardápio] Tab Meu Pedido selecionada"); setActiveTab("pedido"); }}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 4,
            borderBottomWidth: 2,
            borderBottomColor: activeTab === "pedido" ? "#22c55e" : "transparent",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text
            style={{
              fontFamily: activeTab === "pedido" ? "Outfit_700Bold" : "Outfit_400Regular",
              fontSize: 15,
              color: activeTab === "pedido" ? "#22c55e" : "#888",
            }}
          >
            {pedidoTabLabel}
          </Text>
          {cartCount > 0 && (
            <View
              style={{
                backgroundColor: "#22c55e",
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
        </Pressable>
      </View>

      {/* ── Content ── */}
      <View style={{ flex: 1 }}>
        {activeTab === "cardapio" ? (
          loading ? (
            <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 160 }}>
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
                <Ionicons name="alert-circle-outline" size={34} color="#ef4444" />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: "#111", textAlign: "center" }}>
                Erro ao carregar cardápio
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: "#888", textAlign: "center", lineHeight: 20 }}>
                {loadError}
              </Text>
              <Pressable
                onPress={() => { console.log("[Cardápio] Tentar novamente pressionado"); fetchPratos(); }}
                style={({ pressed }) => ({
                  backgroundColor: "#22c55e",
                  borderRadius: 12,
                  paddingHorizontal: 28,
                  paddingVertical: 13,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
                  Tentar novamente
                </Text>
              </Pressable>
            </View>
          ) : pratos.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  backgroundColor: "#dcfce7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UtensilsCrossed size={36} color="#22c55e" />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 18, color: "#111", textAlign: "center" }}>
                Nenhum prato disponível
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: "#888", textAlign: "center", lineHeight: 21 }}>
                O cardápio está vazio no momento
              </Text>
            </View>
          ) : (
            <FlatList
              data={pratos}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 160 }}
              renderItem={({ item, index }) => {
                const cartItem = cart.find((c) => c.id === item.id);
                const qty = cartItem?.quantidade ?? 0;
                return (
                  <PratoCard
                    prato={item}
                    cartQuantidade={qty}
                    observacao={observacoes[item.id] ?? ""}
                    onAdd={() => addToCart(item)}
                    onObservacaoChange={(text) => setObservacao(item.id, text)}
                    index={index}
                  />
                );
              }}
            />
          )
        ) : (
          // ── Meu Pedido Tab ──
          cartIsEmpty ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 14 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  backgroundColor: "#dcfce7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShoppingCart size={36} color="#22c55e" />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 18, color: "#111", textAlign: "center" }}>
                Carrinho vazio
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: "#888", textAlign: "center", lineHeight: 21 }}>
                Adicione pratos do cardápio para montar o pedido
              </Text>
              <Pressable
                onPress={() => { console.log("[Carrinho] Ir para cardápio pressionado"); setActiveTab("cardapio"); }}
                style={({ pressed }) => ({
                  backgroundColor: "#dcfce7",
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: "#22c55e30",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#22c55e" }}>
                  Ver cardápio
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 160 }}>
              {cart.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onIncrement={() => incrementItem(item.id)}
                  onDecrement={() => decrementItem(item.id)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}

              {/* Subtotal card */}
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 8,
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 4,
                  elevation: 1,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: "#888" }}>
                    Subtotal
                  </Text>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: "#aaa", marginTop: 2 }}>
                    {cartCount}
                    <Text> {cartCount === 1 ? "item" : "itens"}</Text>
                  </Text>
                </View>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: "#22c55e" }}>
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
          bottom: 90,
        }}
      >
        <Pressable
          onPress={() => {
            console.log("[Cardápio] Salvar e Enviar Pedido pressionado — cart items:", cart.length, "total:", subtotalDisplay);
            handleSubmit();
          }}
          disabled={submitting || cartIsEmpty}
          style={({ pressed }) => ({
            backgroundColor: "#22c55e",
            borderRadius: 14,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#22c55e",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: cartIsEmpty ? 0 : 0.3,
            shadowRadius: 8,
            elevation: 4,
            flexDirection: "row",
            gap: 8,
            opacity: cartIsEmpty || submitting ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {!cartIsEmpty && <ShoppingCart size={18} color="#fff" />}
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                {cartIsEmpty ? "Adicione itens ao pedido" : "Salvar e Enviar Pedido"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
