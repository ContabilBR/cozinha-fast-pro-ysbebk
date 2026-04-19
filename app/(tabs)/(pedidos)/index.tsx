import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
  Pressable,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { BACKEND_URL, getBearerToken } from "@/utils/api";

// ─── API response types ───────────────────────────────────────────────────────

interface ApiPedidoItem {
  id: string;
  prato?: { nome: string; imagem_url?: string };
  prato_nome?: string;
  quantidade: number;
  preco_unitario?: number;
  observacao?: string;
  status: "aguardando" | "preparando" | "pronto" | string;
  created_at?: string;
}

interface ApiComanda {
  id: string;
  mesa?: { numero: number };
  mesa_numero?: number;
  created_at: string;
  pedidos?: ApiPedidoItem[];
  itens?: ApiPedidoItem[];
}

// ─── Internal display types ───────────────────────────────────────────────────

interface GarcomPedidoItem {
  id: string;
  prato_nome: string;
  quantidade: number;
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

function normaliseComandas(raw: any): GarcomPedido[] {
  // Handle both { comandas: [...] } and direct array
  const list: ApiComanda[] = Array.isArray(raw) ? raw : (raw?.comandas ?? []);

  return list.map((comanda, idx) => {
    const mesaNumero = comanda.mesa?.numero ?? comanda.mesa_numero ?? 0;
    const rawItems: ApiPedidoItem[] = comanda.pedidos ?? comanda.itens ?? [];

    const itens: GarcomPedidoItem[] = rawItems.map((item) => ({
      id: item.id,
      prato_nome: item.prato?.nome ?? item.prato_nome ?? "Prato",
      quantidade: item.quantidade,
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

function ItemRow({ item }: { item: GarcomPedidoItem }) {
  const COLORS = useColors();
  const cfg = getStatusConfig(item.status);
  const quantLabel = `${item.quantidade}x`;
  const hasObs = !!item.observacao;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        paddingVertical: 10,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
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
        {hasObs && (
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 12,
              color: COLORS.textSecondary,
              fontStyle: "italic",
              marginTop: 3,
              marginLeft: 30,
            }}
          >
            {item.observacao}
          </Text>
        )}
      </View>
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
    </View>
  );
}

function PedidoCard({ pedido, index }: { pedido: GarcomPedido; index: number }) {
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
          <View>
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

          {/* Right: Mesa pill */}
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
        </View>

        {/* Items list */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          {pedido.itens.map((item, i) => (
            <View key={item.id}>
              <ItemRow item={item} />
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
    console.log("[Pedidos Garçom] Fetching GET /api/garcom/pedidos");
    try {
      const token = await getBearerToken();
      console.log("[Pedidos Garçom] Token available:", !!token);

      const res = await fetch(`${BACKEND_URL}/api/garcom/pedidos`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[Pedidos Garçom] HTTP error", res.status, errText);
        throw new Error(`Erro ${res.status}: ${errText}`);
      }

      const data = await res.json();
      console.log("[Pedidos Garçom] raw response:", JSON.stringify(data));

      const list = normaliseComandas(data);
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
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
