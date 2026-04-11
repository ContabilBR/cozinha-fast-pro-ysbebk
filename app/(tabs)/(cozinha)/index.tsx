import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { KitchenQueueItem, ItemStatus } from "@/types";
import { apiGet, apiPut } from "@/utils/api";
import { formatRelativeTime, getItemStatusLabel } from "@/utils/helpers";
import { Flame, Clock, ChefHat, RefreshCw } from "lucide-react-native";
import { COLORS as C } from "@/constants/Colors";

const STATUS_COLORS: Record<ItemStatus, string> = {
  pendente: C.statusPendente,
  recebido: C.statusRecebido,
  em_preparo: C.statusEmPreparo,
  pronto: C.statusPronto,
  entregue: C.statusEntregue,
  cancelado: C.statusCancelado,
};

const NEXT_STATUS: Partial<Record<ItemStatus, { status: ItemStatus; label: string; color: string }>> = {
  pendente: { status: "recebido", label: "Receber", color: C.statusRecebido },
  recebido: { status: "em_preparo", label: "Iniciar Preparo", color: C.statusEmPreparo },
  em_preparo: { status: "pronto", label: "Marcar Pronto", color: C.statusPronto },
  pronto: { status: "entregue", label: "Confirmar Entrega", color: C.statusEntregue },
};

const SECTION_ORDER: ItemStatus[] = ["pendente", "recebido", "em_preparo", "pronto"];

function resolveImageSource(source: string | undefined) {
  if (!source) return { uri: "" };
  return { uri: source };
}

function KitchenCard({
  item,
  onStatusChange,
  index,
}: {
  item: KitchenQueueItem;
  onStatusChange: (itemId: string, newStatus: ItemStatus) => Promise<void>;
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
  }, []);

  const statusColor = STATUS_COLORS[item.status] || COLORS.textSecondary;
  const timeStr = formatRelativeTime(item.requested_at);
  const diffMs = Date.now() - new Date(item.requested_at).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const isUrgent = diffMin > 15;
  const nextAction = NEXT_STATUS[item.status];

  const handleAction = async () => {
    if (!nextAction) return;
    console.log("[Cozinha] Status change:", item.item_id, "->", nextAction.status);
    setUpdating(true);
    try {
      await onStatusChange(item.item_id, nextAction.status);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          marginBottom: 10,
          borderWidth: 1.5,
          borderColor: isUrgent ? C.danger + "40" : COLORS.border,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* Urgent indicator */}
        {isUrgent && (
          <View style={{ backgroundColor: C.danger + "15", paddingHorizontal: 16, paddingVertical: 6 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: C.danger }}>
              Aguardando há {diffMin} min — URGENTE
            </Text>
          </View>
        )}

        <View style={{ padding: 14, flexDirection: "row", gap: 12 }}>
          {/* Dish image */}
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              backgroundColor: COLORS.surfaceSecondary,
              overflow: "hidden",
            }}
          >
            {item.dish_image_url ? (
              <Image
                source={resolveImageSource(item.dish_image_url)}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ChefHat size={24} color={COLORS.textTertiary} />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text
                numberOfLines={2}
                style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.text, flex: 1, marginRight: 8 }}
              >
                {item.dish_name}
              </Text>
              <View
                style={{
                  backgroundColor: statusColor + "20",
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: statusColor }}>
                  {getItemStatusLabel(item.status)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>
                Mesa {item.table_number}
              </Text>
              {item.waiter_name && (
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
                  {item.waiter_name}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Clock size={12} color={isUrgent ? C.danger : COLORS.textSecondary} />
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 12,
                  color: isUrgent ? C.danger : COLORS.textSecondary,
                }}
              >
                {timeStr}
              </Text>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: COLORS.text, marginLeft: 8 }}>
                x{item.quantity}
              </Text>
            </View>

            {item.notes && (
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 12,
                  color: COLORS.textSecondary,
                  fontStyle: "italic",
                }}
              >
                Obs: {item.notes}
              </Text>
            )}
          </View>
        </View>

        {/* Action button */}
        {nextAction && (
          <AnimatedPressable
            onPress={handleAction}
            disabled={updating}
            style={{
              backgroundColor: nextAction.color,
              paddingVertical: 12,
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

  const [items, setItems] = useState<KitchenQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchQueue = useCallback(async () => {
    console.log("[Cozinha] Fetching kitchen queue");
    try {
      const data = await apiGet<KitchenQueueItem[]>("/api/kitchen/queue");
      setItems(Array.isArray(data) ? data : []);
      setError("");
    } catch (e: any) {
      console.error("[Cozinha] Error:", e);
      setError("Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => {
      console.log("[Cozinha] Auto-refresh");
      fetchQueue();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleRefresh = () => {
    console.log("[Cozinha] Manual refresh");
    setRefreshing(true);
    fetchQueue();
  };

  const handleStatusChange = async (itemId: string, newStatus: ItemStatus) => {
    console.log("[Cozinha] Updating item status:", itemId, "->", newStatus);
    try {
      await apiPut(`/api/kitchen/items/${itemId}/status`, { status: newStatus });
      setItems((prev) =>
        prev.map((i) => (i.item_id === itemId ? { ...i, status: newStatus } : i))
      );
    } catch (e) {
      console.error("[Cozinha] Status update error:", e);
    }
  };

  // Group by status sections
  const sections = SECTION_ORDER.map((status) => ({
    status,
    data: items.filter((i) => i.status === status),
  })).filter((s) => s.data.length > 0);

  const flatData: Array<{ type: "header"; status: ItemStatus } | { type: "item"; item: KitchenQueueItem; index: number }> = [];
  let globalIndex = 0;
  sections.forEach((section) => {
    flatData.push({ type: "header", status: section.status });
    section.data.forEach((item) => {
      flatData.push({ type: "item", item, index: globalIndex++ });
    });
  });

  const pendingCount = items.filter((i) => i.status === "pendente").length;
  const inProgressCount = items.filter((i) => i.status === "em_preparo" || i.status === "recebido").length;

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
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Flame size={24} color={COLORS.primary} />
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
              Fila da Cozinha
            </Text>
          </View>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
            {pendingCount} pendentes · {inProgressCount} em preparo
          </Text>
        </View>
        <AnimatedPressable
          onPress={handleRefresh}
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
            onPress={fetchQueue}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) =>
            item.type === "header" ? `header-${item.status}` : `item-${item.item.item_id}`
          }
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
          renderItem={({ item }) => {
            if (item.type === "header") {
              const color = STATUS_COLORS[item.status] || COLORS.textSecondary;
              return (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {getItemStatusLabel(item.status)}
                  </Text>
                </View>
              );
            }
            return (
              <KitchenCard
                item={item.item}
                onStatusChange={handleStatusChange}
                index={item.index}
              />
            );
          }}
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
                <Flame size={32} color={COLORS.primary} />
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
