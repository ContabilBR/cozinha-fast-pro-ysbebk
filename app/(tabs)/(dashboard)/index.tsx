import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { apiGet } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";
import { TrendingUp, ShoppingBag, Grid3x3, Flame, RefreshCw, ChevronRight } from "lucide-react-native";

interface ReportSummary {
  total_revenue?: number;
  total_orders?: number;
  open_orders?: number;
  avg_ticket?: number;
  top_dishes?: { dish_name: string; quantity_sold: number }[];
  orders_by_status?: { aberta?: number; fechada?: number; cancelada?: number };
}

interface ApiTable {
  id: string;
  number: number;
  capacity: number;
  status: string;
}

interface ApiOrder {
  id: string;
  table_number: number;
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

function StatCard({
  title,
  value,
  color,
  icon,
  loading,
}: {
  title: string;
  value: string;
  color: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  const COLORS = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 8,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: color + "18",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      {loading ? (
        <>
          <SkeletonLine width="70%" height={22} />
          <SkeletonLine width="50%" height={13} />
        </>
      ) : (
        <>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: COLORS.text, letterSpacing: -0.3 }}>
            {value}
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
            {title}
          </Text>
        </>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [summary, setSummary] = useState<ReportSummary>({});
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    console.log("[Dashboard] Fetching dashboard data");
    try {
      const [summaryRes, tablesRes, ordersRes] = await Promise.all([
        apiGet<any>("/api/reports/summary").catch((e) => {
          console.error("[Dashboard] reports/summary error:", e instanceof Error ? e.message : String(e));
          return {};
        }),
        apiGet<any>("/api/tables").catch((e) => {
          console.error("[Dashboard] tables error:", e instanceof Error ? e.message : String(e));
          return [];
        }),
        apiGet<any>("/api/orders").catch((e) => {
          console.error("[Dashboard] orders error:", e instanceof Error ? e.message : String(e));
          return [];
        }),
      ]);

      const summaryData: ReportSummary = summaryRes || {};
      const tableList: ApiTable[] = Array.isArray(tablesRes) ? tablesRes : (tablesRes.tables || []);
      const orderList: ApiOrder[] = Array.isArray(ordersRes) ? ordersRes : (ordersRes.orders || []);

      console.log("[Dashboard] Loaded summary, tables:", tableList.length, "orders:", orderList.length);
      setSummary(summaryData);
      setTables(tableList);
      const sorted = orderList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentOrders(sorted.slice(0, 5));
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) {
      console.error("[Dashboard] Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fadeAnim]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    console.log("[Dashboard] Manual refresh");
    setRefreshing(true);
    fetchData();
  };

  const totalRevenue = formatCurrency(summary.total_revenue ?? 0);
  const openOrders = String(summary.open_orders ?? 0);
  const totalOrders = String(summary.total_orders ?? 0);
  const avgTicket = formatCurrency(summary.avg_ticket ?? 0);
  const occupiedCount = tables.filter((t) => t.status !== "livre" && t.status !== "free").length;
  const totalTables = tables.length;

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
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
            Dashboard
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
            Visão geral do restaurante
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

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              title="Faturamento Total"
              value={totalRevenue}
              color={COLORS.success}
              icon={<TrendingUp size={20} color={COLORS.success} />}
              loading={loading}
            />
            <StatCard
              title="Pedidos Abertos"
              value={openOrders}
              color={COLORS.primary}
              icon={<ShoppingBag size={20} color={COLORS.primary} />}
              loading={loading}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              title="Mesas Ocupadas"
              value={`${occupiedCount}/${totalTables}`}
              color="#3B82F6"
              icon={<Grid3x3 size={20} color="#3B82F6" />}
              loading={loading}
            />
            <StatCard
              title="Ticket Médio"
              value={avgTicket}
              color={COLORS.warning}
              icon={<Flame size={20} color={COLORS.warning} />}
              loading={loading}
            />
          </View>
        </Animated.View>

        {/* Top dishes */}
        {!loading && summary.top_dishes && summary.top_dishes.length > 0 && (
          <View>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
              Pratos Mais Pedidos
            </Text>
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 10,
              }}
            >
              {summary.top_dishes.slice(0, 5).map((dish, i) => (
                <View key={dish.dish_name + i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text, flex: 1 }}>
                    {dish.dish_name}
                  </Text>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: COLORS.primary, marginLeft: 8 }}>
                    {dish.quantity_sold}x
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tables mini-grid */}
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
            Mesas
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {loading
              ? [0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.surfaceSecondary }} />
                ))
              : tables.map((table) => {
                  const isOccupied = table.status !== "livre" && table.status !== "free";
                  const color = isOccupied ? "#E8521A" : "#22C55E";
                  return (
                    <AnimatedPressable
                      key={table.id}
                      onPress={() => {
                        console.log("[Dashboard] Table mini pressed:", table.number);
                        router.push("/(tabs)/(mesas)");
                      }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        backgroundColor: color + "18",
                        borderWidth: 1.5,
                        borderColor: color + "40",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color }}>
                        {table.number}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
          </View>
        </View>

        {/* Recent orders */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text }}>
              Últimos Pedidos
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log("[Dashboard] View all orders pressed");
                router.push("/(tabs)/(relatorios)");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>
                Ver relatórios
              </Text>
              <ChevronRight size={14} color={COLORS.primary} />
            </AnimatedPressable>
          </View>
          {loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8 }}>
                  <SkeletonLine width="40%" height={14} />
                  <SkeletonLine width="60%" height={12} />
                </View>
              ))}
            </View>
          ) : recentOrders.length === 0 ? (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                Nenhum pedido recente
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {recentOrders.map((order) => {
                const statusColor = ORDER_STATUS_COLORS[order.status] || "#94A3B8";
                const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
                const totalStr = formatCurrency(order.total);
                return (
                  <AnimatedPressable
                    key={order.id}
                    onPress={() => {
                      console.log("[Dashboard] Recent order pressed:", order.id);
                      router.push(`/order/${order.id}`);
                    }}
                    style={{
                      backgroundColor: COLORS.surface,
                      borderRadius: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ gap: 3 }}>
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                        Mesa {order.table_number}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                        {order.items_count} {order.items_count === 1 ? "item" : "itens"}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: COLORS.primary }}>
                        {totalStr}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: statusColor + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: statusColor }}>
                        {statusLabel}
                      </Text>
                    </View>
                  </AnimatedPressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
