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
import { apiGet, apiPut } from "@/utils/api";
import { formatElapsed } from "@/utils/helpers";
import { Flame, Clock, RefreshCw, ChefHat } from "lucide-react-native";

interface KitchenPedido {
  id: string;
  comanda_id: string;
  prato_id: string;
  prato?: { id: string; nome: string };
  quantidade: number;
  status: string;
  observacao?: string;
  created_at?: string;
  mesa?: { numero: number };
  comanda?: { mesa?: { numero: number } };
}

const NEXT_ACTION: Record<string, { status: string; label: string }> = {
  pendente: { status: "em_preparo", label: "Iniciar Preparo" },
  em_preparo: { status: "pronto", label: "Marcar Pronto" },
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "#94A3B8",
  em_preparo: "#F59E0B",
  pronto: "#22C55E",
  entregue: "#0D9488",
  cancelado: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_preparo: "Em Preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function KitchenItemCard({
  item,
  onAction,
  index,
}: {
  item: KitchenPedido;
  onAction: (id: string, status: string) => Promise<void>;
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

  const createdAt = item.created_at;
  const elapsed = formatElapsed(createdAt);
  const diffMin = createdAt ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000) : 0;
  const isUrgent = diffMin > 20;
  const isWarning = diffMin > 10 && !isUrgent;
  const borderColor = isUrgent ? "#EF444460" : isWarning ? "#F59E0B60" : COLORS.border;
  const nextAction = NEXT_ACTION[item.status];
  const statusColor = STATUS_COLORS[item.status] || "#94A3B8";
  const statusLabel = STATUS_LABELS[item.status] || item.status;
  const mesaNum = item.comanda?.mesa?.numero ?? item.mesa?.numero ?? "?";
  const pratoNome = item.prato?.nome ?? "Prato";

  const handleAction = async () => {
    if (!nextAction) return;
    console.log("[Cozinha] Action button pressed:", item.id, "->", nextAction.status);
    setUpdating(true);
    try {
      await onAction(item.id, nextAction.status);
    } finally {
      setUpdating(false);
    }
  };

  const actionBgColor = nextAction
    ? nextAction.status === "em_preparo"
      ? "#F59E0B"
      : "#22C55E"
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
          overflow: "hidden",
        }}
      >
        {isUrgent && (
          <View style={{ backgroundColor: "#EF444415", paddingHorizontal: 16, paddingVertical: 6 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: "#EF4444" }}>
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
                  Pedido #{item.id.slice(-6)}
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
                <Clock size={11} color={isUrgent ? "#EF4444" : COLORS.textSecondary} />
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: isUrgent ? "#EF4444" : COLORS.textSecondary }}>
                  {elapsed}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
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
                  {pratoNome}
                </Text>
                {item.observacao ? (
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary, fontStyle: "italic" }}>
                    {item.observacao}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
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

  const [items, setItems] = useState<KitchenPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchFila = useCallback(async () => {
    console.log("[Cozinha] Fetching kitchen queue from /api/pedidos");
    try {
      const [pendentesRes, emPreparoRes] = await Promise.all([
        apiGet<any>("/api/pedidos?status=pendente"),
        apiGet<any>("/api/pedidos?status=em_preparo"),
      ]);
      const pendentes: KitchenPedido[] = Array.isArray(pendentesRes) ? pendentesRes : (pendentesRes.pedidos || []);
      const emPreparo: KitchenPedido[] = Array.isArray(emPreparoRes) ? emPreparoRes : (emPreparoRes.pedidos || []);
      const all = [...pendentes, ...emPreparo];
      const sorted = all.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });
      console.log("[Cozinha] Loaded", sorted.length, "kitchen items (pendente + em_preparo)");
      setItems(sorted);
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
      console.log("[Cozinha] Auto-refresh (30s)");
      fetchFila();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchFila]);

  const handleRefresh = () => {
    console.log("[Cozinha] Manual refresh");
    setRefreshing(true);
    fetchFila();
  };

  const handleAction = async (id: string, status: string) => {
    console.log("[Cozinha] PUT pedido status:", id, "->", status);
    try {
      await apiPut(`/api/pedidos/${id}/status`, { status });
      console.log("[Cozinha] Status updated, refreshing");
      await fetchFila();
    } catch (e) {
      console.error("[Cozinha] Status update error:", e);
    }
  };

  const pendingCount = items.filter((i) => i.status === "pendente").length;
  const inProgressCount = items.filter((i) => i.status === "em_preparo").length;
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
              Cozinha
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
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
            {error}
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
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
          renderItem={({ item, index }) => (
            <KitchenItemCard item={item} onAction={handleAction} index={index} />
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
                Nenhum item aguardando preparo
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
