import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet } from "@/utils/api";
import { ClipboardList, Clock, ChefHat } from "lucide-react-native";

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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  aguardando: { label: "Aguardando", bg: "#FEF3C7", text: "#D97706" },
  preparando: { label: "Preparando", bg: "#DBEAFE", text: "#2563EB" },
  pronto:     { label: "Pronto",     bg: "#DCFCE7", text: "#16A34A" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, bg: "#F1F5F9", text: "#64748B" };
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${date} às ${time}`;
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
        paddingVertical: 8,
      }}
    >
      <View style={{ flex: 1, marginRight: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: COLORS.primary }}>
            {quantLabel}
          </Text>
          <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 13, color: COLORS.text, flex: 1 }}>
            {item.prato_nome}
          </Text>
        </View>
        {hasObs && (
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 11,
              color: COLORS.textSecondary,
              fontStyle: "italic",
              marginTop: 2,
              marginLeft: 22,
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
          paddingHorizontal: 9,
          paddingVertical: 3,
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: cfg.text }}>
          {cfg.label}
        </Text>
      </View>
    </View>
  );
}

function PedidoCard({ pedido, index }: { pedido: GarcomPedido; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 70, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const dateStr = formatDateTime(pedido.created_at);
  const itemCount = pedido.itens.length;
  const itemCountLabel = `${itemCount} ${itemCount === 1 ? "item" : "itens"}`;
  const pedidoLabel = `Pedido #${pedido.numero_sequencial}`;
  const mesaLabel = `Mesa ${pedido.mesa_numero}`;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: COLORS.primaryMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChefHat size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text }}>
                {pedidoLabel}
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
                {itemCountLabel}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>
              {mesaLabel}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
              <Clock size={11} color={COLORS.textSecondary} />
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
                {dateStr}
              </Text>
            </View>
          </View>
        </View>

        {/* Items list */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
          {pedido.itens.map((item, i) => (
            <View key={item.id}>
              <ItemRow item={item} />
              {i < pedido.itens.length - 1 && (
                <View style={{ height: 1, backgroundColor: COLORS.divider }} />
              )}
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

export default function PedidosGarcomScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [pedidos, setPedidos] = useState<GarcomPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPedidos = useCallback(async () => {
    console.log("[Pedidos Garçom] Fetching from GET /api/garcom/pedidos");
    try {
      const res = await apiGet<GarcomPedido[]>("/api/garcom/pedidos");
      const list: GarcomPedido[] = Array.isArray(res) ? res : [];
      console.log("[Pedidos Garçom] Loaded", list.length, "pedidos");
      setPedidos(list);
      setError("");
    } catch (e: any) {
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

  const pedidoCount = pedidos.length;
  const pedidoCountLabel = `${pedidoCount} ${pedidoCount === 1 ? "pedido" : "pedidos"}`;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
          Meus Pedidos
        </Text>
        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
          {loading ? "Carregando..." : pedidoCountLabel}
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 16 }}>
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: "rgba(239,68,68,0.1)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ClipboardList size={32} color={COLORS.danger} />
          </View>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
            Erro ao carregar pedidos
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 14,
              color: COLORS.textSecondary,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
          <AnimatedPressable
            onPress={handleRetry}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          {pedidos.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", padding: 48, gap: 12 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ClipboardList size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Nenhum pedido encontrado
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 14,
                  color: COLORS.textSecondary,
                  textAlign: "center",
                }}
              >
                Os pedidos que você registrar aparecerão aqui
              </Text>
            </View>
          ) : (
            pedidos.map((pedido, index) => (
              <PedidoCard key={pedido.comanda_id + pedido.numero_sequencial} pedido={pedido} index={index} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
