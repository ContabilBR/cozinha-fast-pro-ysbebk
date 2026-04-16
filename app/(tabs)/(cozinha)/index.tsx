import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Pedido, PedidoStatus } from "@/types";
import { apiGet, apiPatch } from "@/utils/api";
import { formatElapsed, getPedidoStatusLabel, getPedidoStatusColor } from "@/utils/helpers";
import { Flame, Clock, RefreshCw, ChefHat } from "lucide-react-native";
import { COLORS as C } from "@/constants/Colors";

const NEXT_ACTION: Partial<Record<PedidoStatus, { status: PedidoStatus; label: string }>> = {
  pendente: { status: "recebido", label: "Receber" },
  recebido: { status: "em_preparacao", label: "Iniciar Preparo" },
  em_preparacao: { status: "pronto", label: "Marcar Pronto" },
};

function PedidoCard({
  pedido,
  onAction,
  index,
}: {
  pedido: Pedido;
  onAction: (id: string, status: PedidoStatus) => Promise<void>;
  index: number;
}) {
  const COLORS = useColors();
  const [updating, setUpdating] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const elapsed = formatElapsed(pedido.sent_at);
  const diffMin = Math.floor((Date.now() - new Date(pedido.sent_at).getTime()) / 60000);
  const isUrgent = diffMin > 20;
  const isWarning = diffMin > 10 && !isUrgent;
  const borderColor = isUrgent ? C.danger + "60" : isWarning ? C.warning + "60" : COLORS.border;
  const nextAction = NEXT_ACTION[pedido.status];
  const statusColor = getPedidoStatusColor(pedido.status);
  const statusLabel = getPedidoStatusLabel(pedido.status);
  const mesaNum = pedido.mesa?.numero ?? "?";
  const garcomName = pedido.garcom?.name ?? "—";

  const handleAction = async () => {
    if (!nextAction) return;
    console.log("[Cozinha] Action button pressed:", pedido.id, "->", nextAction.status);
    setUpdating(true);
    try {
      await onAction(pedido.id, nextAction.status);
    } finally {
      setUpdating(false);
    }
  };

  const actionBgColor = nextAction
    ? nextAction.status === "recebido"
      ? C.statusRecebido
      : nextAction.status === "em_preparacao"
      ? C.statusEmPreparo
      : C.statusPronto
    : COLORS.primary;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          marginBottom: 10,
          borderWidth: 1.5,
          borderColor,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {isUrgent && (
          <View style={{ backgroundColor: C.danger + "15", paddingHorizontal: 16, paddingVertical: 6 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: C.danger }}>
              Aguardando há {diffMin} min — URGENTE
            </Text>
          </View>
        )}

        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>
                  {mesaNum}
                </Text>
              </View>
              <View>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text }}>
                  Mesa {mesaNum}
                </Text>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                  {garcomName}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View
                style={{
                  backgroundColor: statusColor + "20",
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: statusColor }}>
                  {statusLabel}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Clock size={11} color={isUrgent ? C.danger : COLORS.textSecondary} />
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: isUrgent ? C.danger : COLORS.textSecondary }}>
                  {elapsed}
                </Text>
              </View>
            </View>
          </View>

          {/* Itens */}
          <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
            {pedido.itens.map((item) => (
              <View key={item.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    backgroundColor: COLORS.primaryMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: COLORS.primary }}>
                    {item.quantidade}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
                    {item.prato?.nome ?? "Prato"}
                  </Text>
                  {item.observacoes ? (
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary, fontStyle: "italic" }}>
                      {item.observacoes}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {pedido.observacoes ? (
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic" }}>
              Obs: {pedido.observacoes}
            </Text>
          ) : null}
        </View>

        {nextAction && (
          <AnimatedPressable
            onPress={handleAction}
            disabled={updating}
            style={{
              backgroundColor: actionBgColor,
              paddingVertical: 13,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {updating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: "#fff" }}>
                {nextAction.label}
              </Text>
            )}
          </AnimatedPressable>
        )}
      </View>
    </Animated.View>
  );
}

export default function CozinhaScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchFila = useCallback(async () => {
    console.log("[Cozinha] Fetching kitchen queue");
    try {
      const res = await apiGet<any>("/api/cozinha/fila");
      const list: Pedido[] = Array.isArray(res) ? res : (res.pedidos || []);
      const sorted = list.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
      setPedidos(sorted);
      setLastRefresh(new Date());
      setError("");
    } catch (e: any) {
      console.error("[Cozinha] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFila();
    const interval = setInterval(() => {
      console.log("[Cozinha] Auto-refresh");
      fetchFila();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchFila]);

  const handleRefresh = () => {
    console.log("[Cozinha] Manual refresh");
    setRefreshing(true);
    fetchFila();
  };

  const handleAction = async (id: string, status: PedidoStatus) => {
    console.log("[Cozinha] PATCH pedido status:", id, "->", status);
    try {
      await apiPatch(`/api/pedidos/${id}/status`, { status });
      console.log("[Cozinha] Status updated, refreshing");
      await fetchFila();
    } catch (e) {
      console.error("[Cozinha] Status update error:", e);
    }
  };

  const pendingCount = pedidos.filter((p) => p.status === "pendente").length;
  const inProgressCount = pedidos.filter((p) => p.status === "recebido" || p.status === "em_preparacao").length;
  const lastRefreshMin = Math.floor((Date.now() - lastRefresh.getTime()) / 60000);
  const lastRefreshLabel = lastRefreshMin < 1 ? "agora" : `há ${lastRefreshMin} min`;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Flame size={22} color={COLORS.primary} />
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
              Fila da Cozinha
            </Text>
          </View>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
            {pendingCount} pendentes · {inProgressCount} em preparo
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <AnimatedPressable
            onPress={handleRefresh}
            accessibilityLabel="Atualizar fila"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RefreshCw size={18} color={COLORS.textSecondary} />
          </AnimatedPressable>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 10, color: COLORS.textTertiary }}>
            {lastRefreshLabel}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingTop: 16 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
            Erro ao carregar fila
          </Text>
          <AnimatedPressable
            onPress={fetchFila}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
          renderItem={({ item, index }) => (
            <PedidoCard pedido={item} onAction={handleAction} index={index} />
          )}
          ListEmptyComponent={
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
                <ChefHat size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Fila vazia
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                Nenhum pedido aguardando preparo
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
