import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { Table, Order, TableStatus } from "@/types";
import { apiGet } from "@/utils/api";
import { formatCurrency, formatRelativeTime } from "@/utils/helpers";
import { TrendingUp, ShoppingBag, Grid3x3, Flame, RefreshCw } from "lucide-react-native";

const STATUS_COLORS: Record<TableStatus, string> = {
  livre: "#22C55E",
  ocupada: "#E8521A",
  reservada: "#F59E0B",
  fechando: "#8B5CF6",
};

interface DashboardData {
  revenue_today?: number;
  open_orders?: number;
  occupied_tables?: number;
  total_tables?: number;
  kitchen_queue?: number;
}

function StatCard({
  title,
  value,
  subtitle,
  color,
  icon,
  loading,
}: {
  title: string;
  value: string;
  subtitle?: string;
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
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
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
          {subtitle && (
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: color }}>
              {subtitle}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [dashboard, setDashboard] = useState<DashboardData>({});
  const [tables, setTables] = useState<Table[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    console.log("[Dashboard] Fetching dashboard data");
    try {
      const [dashData, tablesData, ordersData] = await Promise.all([
        apiGet<DashboardData>("/api/dashboard").catch(() => ({})),
        apiGet<Table[]>("/api/tables").catch(() => []),
        apiGet<Order[]>("/api/orders?status=fechada&limit=5").catch(() => []),
      ]);
      setDashboard(dashData);
      setTables(tablesData);
      setRecentOrders(ordersData.slice(0, 5));
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e) {
      console.error("[Dashboard] Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    console.log("[Dashboard] Manual refresh");
    setRefreshing(true);
    fetchData();
  };

  const occupiedCount = tables.filter((t) => t.status === "ocupada" || t.status === "fechando").length;
  const totalTables = tables.length;
  const revenueToday = formatCurrency(dashboard.revenue_today ?? 0);
  const openOrders = String(dashboard.open_orders ?? 0);
  const kitchenQueue = String(dashboard.kitchen_queue ?? 0);
  const occupiedLabel = `${occupiedCount}/${totalTables}`;

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
        {/* Stats grid */}
        <Animated.View style={{ opacity: fadeAnim, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              title="Faturamento Hoje"
              value={revenueToday}
              color={COLORS.success}
              icon={<TrendingUp size={20} color={COLORS.success} />}
              loading={loading}
            />
            <StatCard
              title="Comandas Abertas"
              value={openOrders}
              color={COLORS.primary}
              icon={<ShoppingBag size={20} color={COLORS.primary} />}
              loading={loading}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              title="Mesas Ocupadas"
              value={occupiedLabel}
              color="#3B82F6"
              icon={<Grid3x3 size={20} color="#3B82F6" />}
              loading={loading}
            />
            <StatCard
              title="Fila Cozinha"
              value={kitchenQueue}
              color={COLORS.warning}
              icon={<Flame size={20} color={COLORS.warning} />}
              loading={loading}
            />
          </View>
        </Animated.View>

        {/* Tables mini-grid */}
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
            Mesas
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {loading
              ? [0, 1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      backgroundColor: COLORS.surfaceSecondary,
                    }}
                  />
                ))
              : tables.map((table) => {
                  const color = STATUS_COLORS[table.status] || COLORS.textSecondary;
                  return (
                    <View
                      key={table.id}
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
                    </View>
                  );
                })}
          </View>
        </View>

        {/* Recent orders */}
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
            Últimas Comandas
          </Text>
          {loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: COLORS.surface,
                    borderRadius: 12,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    gap: 8,
                  }}
                >
                  <SkeletonLine width="40%" height={14} />
                  <SkeletonLine width="60%" height={12} />
                </View>
              ))}
            </View>
          ) : recentOrders.length === 0 ? (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                Nenhuma comanda fechada ainda
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {recentOrders.map((order) => {
                const tableNum = order.table?.number ?? "?";
                const waiter = order.waiter?.name ?? "—";
                const total = formatCurrency(order.total_amount);
                const time = formatRelativeTime(order.closed_at || order.opened_at);
                return (
                  <View
                    key={order.id}
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
                        Mesa {tableNum}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                        {waiter} · {time}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>
                      {total}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
