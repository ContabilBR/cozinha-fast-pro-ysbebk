import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { apiGet, apiPatch, apiDelete } from "@/utils/api";

// ─── API response types ───────────────────────────────────────────────────────

// Flat pedido item returned by GET /api/pedidos
interface ApiPedidoFlat {
  id: string;
  comanda_id: string;
  mesa_numero?: number;
  prato_nome?: string;
  prato?: { nome: string; imagem_url?: string };
  quantidade: number;
  preco_unitario?: number;
  observacao?: string;
  status: "aguardando" | "preparando" | "pronto" | string;
  created_at?: string;
}

// Comanda-grouped shape (legacy, kept for fallback)
interface ApiComanda {
  id: string;
  mesa?: { numero: number };
  mesa_numero?: number;
  created_at: string;
  pedidos?: ApiPedidoFlat[];
  itens?: ApiPedidoFlat[];
}

// ─── Internal display types ───────────────────────────────────────────────────

interface GarcomPedidoItem {
  id: string;
  prato_nome: string;
  quantidade: number;
  preco_unitario?: number;
  observacao?: string;
  status: "aguardando" | "preparando" | "pronto" | string;
  created_at: string;
}

interface GarcomPedido {
  numero_sequencial: number;
  comanda_id: string;
  mesa_numero: number;
  created_at: string;
  itens: GarcomPedidoItem[];
}

// ─── Normalise raw API response into display shape ────────────────────────────

function normalisePedidos(raw: any): GarcomPedido[] {
  // Handle flat array of pedido items (GET /api/pedidos returns flat list)
  const flatList: ApiPedidoFlat[] = Array.isArray(raw)
    ? raw
    : (raw?.pedidos ?? raw?.comandas ?? []);

  // If the array items have comanda_id, it's a flat pedidos list — group by comanda_id
  if (flatList.length > 0 && "comanda_id" in flatList[0]) {
    const grouped = new Map<string, GarcomPedido>();
    let seq = 1;

    for (const item of flatList) {
      const cid = item.comanda_id;
      if (!grouped.has(cid)) {
        grouped.set(cid, {
          numero_sequencial: seq++,
          comanda_id: cid,
          mesa_numero: item.mesa_numero ?? 0,
          created_at: item.created_at ?? "",
          itens: [],
        });
      }
      const group = grouped.get(cid)!;
      // Update mesa_numero if we get a better value
      if (item.mesa_numero && !group.mesa_numero) {
        group.mesa_numero = item.mesa_numero;
      }
      group.itens.push({
        id: item.id,
        prato_nome: item.prato?.nome ?? item.prato_nome ?? "Prato",
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        observacao: item.observacao,
        status: item.status ?? "aguardando",
        created_at: item.created_at ?? "",
      });
    }

    return Array.from(grouped.values());
  }

  // Fallback: treat as comanda-grouped shape
  const comandas: ApiComanda[] = flatList as unknown as ApiComanda[];
  return comandas.map((comanda, idx) => {
    const mesaNumero = comanda.mesa?.numero ?? comanda.mesa_numero ?? 0;
    const rawItems: ApiPedidoFlat[] = comanda.pedidos ?? comanda.itens ?? [];

    const itens: GarcomPedidoItem[] = rawItems.map((item) => ({
      id: item.id,
      prato_nome: item.prato?.nome ?? item.prato_nome ?? "Prato",
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      observacao: item.observacao,
      status: item.status ?? "aguardando",
      created_at: item.created_at ?? comanda.created_at,
    }));

    return {
      numero_sequencial: idx + 1,
      comanda_id: comanda.id,
      mesa_numero: mesaNumero,
      created_at: comanda.created_at,
      itens,
    };
  });
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  aguardando: { label: "Aguardando", bg: "#F59E0B", text: "#fff" },
  preparando: { label: "Em Preparação", bg: "#3B82F6", text: "#fff" },
  pronto: { label: "Pronto", bg: "#10B981", text: "#fff" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, bg: "#94A3B8", text: "#fff" };
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${day}, ${time}`;
  } catch {
    return iso;
  }
}

function ItemRow({
  item,
  onDelete,
}: {
  item: GarcomPedidoItem;
  onDelete: (id: string) => void;
}) {
  const COLORS = useColors();
  const cfg = getStatusConfig(item.status);
  const quantLabel = `${item.quantidade}x`;

  const [obsValue, setObsValue] = useState(item.observacao ?? "");
  const [obsFocused, setObsFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleObsBlur = useCallback(async () => {
    setObsFocused(false);
    const trimmed = obsValue.trim();
    const original = (item.observacao ?? "").trim();
    if (trimmed === original) return;

    console.log("[Pedidos] PATCH /api/pedidos/" + item.id + "/observacao — observacao:", trimmed);
    setSaving(true);
    setSaveError("");
    try {
      await apiPatch<any>(`/api/pedidos/${item.id}/observacao`, { observacao: trimmed });
      console.log("[Pedidos] Observação atualizada para pedido:", item.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Pedidos] Erro ao salvar observação:", msg);
      setSaveError("Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }, [item.id, item.observacao, obsValue]);

  const handleDeletePress = () => {
    console.log("[Pedidos] Trash icon pressed — pedido item:", item.id, "prato:", item.prato_nome);
    Alert.alert(
      "Excluir prato?",
      "Tem certeza que deseja remover este prato do pedido?",
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => console.log("[Pedidos] Exclusão de item cancelada:", item.id),
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            console.log("[Pedidos] Confirmado — DELETE /api/pedidos/" + item.id);
            onDelete(item.id);
          },
        },
      ]
    );
  };

  return (
    <View style={{ paddingVertical: 10 }}>
      {/* Top row: qty + name + status badge + delete */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
                color: COLORS.primary,
                minWidth: 24,
              }}
            >
              {quantLabel}
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_500Medium",
                fontSize: 14,
                color: COLORS.text,
                flex: 1,
              }}
            >
              {item.prato_nome}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              backgroundColor: cfg.bg,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
              alignSelf: "flex-start",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 11,
                color: cfg.text,
              }}
            >
              {cfg.label}
            </Text>
          </View>

          {/* Delete item button */}
          <Pressable
            onPress={handleDeletePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              padding: 2,
            })}
          >
            <Ionicons name="trash-outline" size={17} color="#EF4444" />
          </Pressable>
        </View>
      </View>

      {/* Observações field */}
      <View style={{ marginTop: 8, marginLeft: 30 }}>
        <Text
          style={{
            fontFamily: "Outfit_500Medium",
            fontSize: 11,
            color: COLORS.textSecondary,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          Observações
        </Text>
        <TextInput
          value={obsValue}
          onChangeText={(t) => {
            setObsValue(t);
            setSaveError("");
          }}
          onFocus={() => {
            console.log("[Pedidos] Campo observação focado — pedido:", item.id);
            setObsFocused(true);
          }}
          onBlur={handleObsBlur}
          placeholder="Ex: sem cebola, bem passado..."
          placeholderTextColor={COLORS.textTertiary ?? "#bbb"}
          multiline
          style={{
            fontFamily: "Outfit_400Regular",
            fontSize: 13,
            color: COLORS.text,
            backgroundColor: COLORS.surfaceSecondary ?? "#f5f5f5",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: obsFocused ? COLORS.primary : (COLORS.border ?? "#e5e5e5"),
            paddingHorizontal: 10,
            paddingVertical: 7,
            minHeight: 36,
            lineHeight: 18,
          }}
        />
        {saving && (
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 11,
              color: COLORS.textSecondary,
              marginTop: 3,
            }}
          >
            Salvando...
          </Text>
        )}
        {!!saveError && (
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 11,
              color: "#ef4444",
              marginTop: 3,
            }}
          >
            {saveError}
          </Text>
        )}
      </View>
    </View>
  );
}

function PedidoCard({
  pedido,
  index,
  onDeleteItem,
  onDeleteComanda,
}: {
  pedido: GarcomPedido;
  index: number;
  onDeleteItem: (comandaId: string, itemId: string) => void;
  onDeleteComanda: (comandaId: string) => void;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  const dateStr = formatDateTime(pedido.created_at);
  const itemCount = pedido.itens.length;
  const itemCountLabel = `${itemCount} ${itemCount === 1 ? "item" : "itens"}`;
  const pedidoLabel = `Pedido #${pedido.numero_sequencial}`;
  const mesaLabel = `Mesa ${pedido.mesa_numero}`;

  const handleDeleteComandaPress = () => {
    console.log("[Pedidos] Trash icon pressed — comanda:", pedido.comanda_id, "mesa:", pedido.mesa_numero);
    Alert.alert(
      "Excluir pedido?",
      "Isso irá remover todos os pratos desta comanda. Deseja continuar?",
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => console.log("[Pedidos] Exclusão de comanda cancelada:", pedido.comanda_id),
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            console.log("[Pedidos] Confirmado — DELETE /api/comandas/" + pedido.comanda_id);
            onDeleteComanda(pedido.comanda_id);
          },
        },
      ]
    );
  };

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        marginHorizontal: 16,
        marginBottom: 14,
      }}
    >
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.border,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {/* Card header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: COLORS.surfaceSecondary,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          {/* Left: order number + date */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 17,
                color: COLORS.text,
                letterSpacing: -0.2,
              }}
            >
              {pedidoLabel}
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_400Regular",
                fontSize: 12,
                color: COLORS.textSecondary,
                marginTop: 2,
              }}
            >
              {dateStr}
            </Text>
          </View>

          {/* Right: Mesa pill + delete comanda */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 13,
                  color: "#fff",
                }}
              >
                {mesaLabel}
              </Text>
            </View>

            {/* Delete comanda button */}
            <Pressable
              onPress={handleDeleteComandaPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.5 : 1,
                padding: 4,
              })}
            >
              <Ionicons name="trash-outline" size={19} color="#EF4444" />
            </Pressable>
          </View>
        </View>

        {/* Items list */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          {pedido.itens.map((item, i) => (
            <View key={item.id}>
              <ItemRow
                item={item}
                onDelete={(itemId) => onDeleteItem(pedido.comanda_id, itemId)}
              />
              {i < pedido.itens.length - 1 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: COLORS.divider,
                  }}
                />
              )}
            </View>
          ))}
        </View>

        {/* Card footer */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: COLORS.divider,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="receipt-outline" size={13} color={COLORS.textSecondary} />
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 12,
              color: COLORS.textSecondary,
            }}
          >
            {itemCountLabel}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function SkeletonCard() {
  const COLORS = useColors();
  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: "hidden",
      }}
    >
      {/* Header skeleton */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: COLORS.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <View style={{ gap: 6 }}>
          <SkeletonLine width={110} height={16} />
          <SkeletonLine width={80} height={12} />
        </View>
        <SkeletonLine width={72} height={32} borderRadius={20} />
      </View>
      {/* Body skeleton */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SkeletonLine width={160} height={14} />
          <SkeletonLine width={80} height={24} borderRadius={20} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SkeletonLine width={130} height={14} />
          <SkeletonLine width={70} height={24} borderRadius={20} />
        </View>
      </View>
    </View>
  );
}

export default function PedidosGarcomScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [pedidos, setPedidos] = useState<GarcomPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPedidos = useCallback(async () => {
    console.log("[Pedidos Garçom] Fetching GET /api/pedidos");
    try {
      const data = await apiGet<any>("/api/pedidos");
      console.log("[Pedidos] raw:", JSON.stringify(data).slice(0, 500));

      const list = normalisePedidos(data);
      console.log("[Pedidos Garçom] Loaded", list.length, "comandas");
      setPedidos(list);
      setError("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Pedidos Garçom] Fetch error:", msg);
      setError("Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPedidos();
    }, [fetchPedidos])
  );

  const handleRefresh = () => {
    console.log("[Pedidos Garçom] Pull-to-refresh triggered");
    setRefreshing(true);
    fetchPedidos();
  };

  const handleRetry = () => {
    console.log("[Pedidos Garçom] Retry button pressed");
    setLoading(true);
    setError("");
    fetchPedidos();
  };

  const handleBack = () => {
    console.log("[Pedidos Garçom] Back button pressed");
    router.back();
  };

  const handleDeleteItem = useCallback(async (comandaId: string, itemId: string) => {
    console.log("[Pedidos] DELETE /api/pedidos/" + itemId + " (comanda:", comandaId + ")");
    try {
      await apiDelete(`/api/pedidos/${itemId}`);
      console.log("[Pedidos] Item deletado com sucesso:", itemId);
      // Remove item from local state
      setPedidos((prev) =>
        prev
          .map((p) =>
            p.comanda_id === comandaId
              ? { ...p, itens: p.itens.filter((it) => it.id !== itemId) }
              : p
          )
          // Remove comanda if it has no more items
          .filter((p) => p.itens.length > 0)
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Pedidos] Erro ao deletar item:", msg);
      Alert.alert("Erro", "Não foi possível remover o prato. Tente novamente.");
    }
  }, []);

  const handleDeleteComanda = useCallback(async (comandaId: string) => {
    console.log("[Pedidos] DELETE /api/comandas/" + comandaId);
    try {
      await apiDelete(`/api/comandas/${comandaId}`);
      console.log("[Pedidos] Comanda deletada com sucesso:", comandaId);
      // Remove entire comanda from local state
      setPedidos((prev) => prev.filter((p) => p.comanda_id !== comandaId));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Pedidos] Erro ao deletar comanda:", msg);
      Alert.alert("Erro", "Não foi possível remover o pedido. Tente novamente.");
    }
  }, []);

  const pedidoCount = pedidos.length;
  const pedidoCountLabel = `${pedidoCount} ${pedidoCount === 1 ? "pedido" : "pedidos"}`;
  const subtitleText = loading ? "Carregando..." : pedidoCountLabel;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Custom header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: 16,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Back button */}
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 4,
            paddingRight: 8,
            opacity: pressed ? 0.6 : 1,
          })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 15,
              color: COLORS.primary,
            }}
          >
            Voltar
          </Text>
        </Pressable>

        {/* Title centered */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 17,
              color: COLORS.text,
              letterSpacing: -0.2,
            }}
          >
            Meus Pedidos
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 12,
              color: COLORS.textSecondary,
              marginTop: 1,
            }}
          >
            {subtitleText}
          </Text>
        </View>

        {/* Spacer to balance back button */}
        <View style={{ width: 70 }} />
      </View>

      {/* Content */}
      {loading ? (
        <ScrollView
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
          scrollEnabled={false}
        >
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </ScrollView>
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 14,
          }}
        >
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
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 17,
              color: COLORS.text,
              textAlign: "center",
            }}
          >
            Erro ao carregar pedidos
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 14,
              color: COLORS.textSecondary,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            {error}
          </Text>
          <AnimatedPressable
            onPress={handleRetry}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              paddingHorizontal: 28,
              paddingVertical: 13,
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 15,
                color: "#fff",
              }}
            >
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 120,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          {pedidos.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 40,
                paddingTop: 80,
                gap: 14,
              }}
            >
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
                <Ionicons name="clipboard-outline" size={38} color={COLORS.primary} />
              </View>
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 18,
                  color: COLORS.text,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Nenhum pedido encontrado
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 14,
                  color: COLORS.textSecondary,
                  textAlign: "center",
                  lineHeight: 21,
                }}
              >
                Os pedidos que você registrar aparecerão aqui
              </Text>
            </View>
          ) : (
            pedidos.map((pedido, index) => (
              <PedidoCard
                key={`${pedido.comanda_id}-${pedido.numero_sequencial}`}
                pedido={pedido}
                index={index}
                onDeleteItem={handleDeleteItem}
                onDeleteComanda={handleDeleteComanda}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
