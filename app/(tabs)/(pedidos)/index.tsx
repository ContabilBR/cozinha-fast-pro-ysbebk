import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet } from "@/utils/api";
import { formatCurrency, formatRelativeTime } from "@/utils/helpers";
import { ClipboardList, Clock, ShoppingBag } from "lucide-react-native";

interface ApiOrder {
  id: string;
  table_id: string;
  table_number: number;
  user_id: string;
  user_name?: string;
  status: string;
  total: number;
  created_at: string;
  items_count: number;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  open: "Aberta",
  fechada: "Fechada",
  closed: "Fechada",
  cancelada: "Cancelada",
  cancelled: "Cancelada",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  aberta: "#22C55E",
  open: "#22C55E",
  fechada: "#94A3B8",
  closed: "#94A3B8",
  cancelada: "#EF4444",
  cancelled: "#EF4444",
};

function OrderCard({ order, onPress, index }: { order: ApiOrder; onPress: () => void; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const statusColor = ORDER_STATUS_COLORS[order.status] || "#94A3B8";
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
  const timeStr = formatRelativeTime(order.created_at);
  const totalStr = formatCurrency(order.total);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={onPress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: COLORS.primaryMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.primary }}>
                {order.table_number}
              </Text>
            </View>
            <View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text }}>
                Mesa {order.table_number}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Clock size={12} color={COLORS.textSecondary} />
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                  {timeStr}
                </Text>
              </View>
            </View>
          </View>
          <View
            style={{
              backgroundColor: statusColor + "20",
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <ShoppingBag size={13} color={COLORS.textSecondary} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
              {order.items_count} {order.items_count === 1 ? "item" : "itens"}
            </Text>
          </View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 14, color: COLORS.primary }}>
            {totalStr}
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function PedidosScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchOrders = useCallback(async () => {
    console.log("[Pedidos] Fetching orders from /api/orders");
    try {
      const res = await apiGet<any>("/api/orders");
      const list: ApiOrder[] = Array.isArray(res) ? res : (res.orders || []);
      const sorted = list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      console.log("[Pedidos] Loaded", sorted.length, "orders");
      setOrders(sorted);
      setError("");
    } catch (e: any) {
      console.error("[Pedidos] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      console.log("[Pedidos] Auto-refresh");
      fetchOrders();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleRefresh = () => {
    console.log("[Pedidos] Manual refresh");
    setRefreshing(true);
    fetchOrders();
  };

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
        }}
      >
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
          Pedidos
        </Text>
        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
          {orders.length} pedidos
        </Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 16 }}>
          {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
            Erro ao carregar pedidos
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={fetchOrders}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={({ item, index }) => (
            <OrderCard
              order={item}
              onPress={() => {
                console.log("[Pedidos] Order pressed:", item.id);
                router.push(`/order/${item.id}`);
              }}
              index={index}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
          }
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
                <ClipboardList size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Nenhum pedido ainda
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                Os pedidos aparecerão aqui
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
