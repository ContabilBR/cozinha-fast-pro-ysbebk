import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLoader";
import { apiGet } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";

type Period = "hoje" | "semana" | "mes";

interface Summary {
  total_revenue?: number;
  order_count?: number;
  avg_ticket?: number;
}

interface DishReport {
  dish_id: string;
  dish_name: string;
  quantity_sold: number;
  revenue: number;
}

interface WaiterReport {
  waiter_id: string;
  waiter_name: string;
  order_count: number;
  revenue: number;
  avg_ticket: number;
}

function getPeriodDates(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  let from: string;
  if (period === "hoje") {
    from = to;
  } else if (period === "semana") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    from = d.toISOString().split("T")[0];
  } else {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    from = d.toISOString().split("T")[0];
  }
  return { from, to };
}

export default function RelatoriosScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState<Period>("hoje");
  const [summary, setSummary] = useState<Summary>({});
  const [dishes, setDishes] = useState<DishReport[]>([]);
  const [waiters, setWaiters] = useState<WaiterReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    console.log("[Relatorios] Fetching reports for period:", period);
    const { from, to } = getPeriodDates(period);
    try {
      const [summaryRes, dishRes, waiterRes] = await Promise.all([
        apiGet<any>(`/api/reports/summary?date_from=${from}&date_to=${to}`).catch(() => ({})),
        apiGet<any>(`/api/reports/dishes?date_from=${from}&date_to=${to}`).catch(() => []),
        apiGet<any>(`/api/reports/waiters?date_from=${from}&date_to=${to}`).catch(() => []),
      ]);
      const summaryData: Summary = summaryRes?.summary || summaryRes || {};
      const dishList: DishReport[] = Array.isArray(dishRes) ? dishRes : (dishRes.dishes || []);
      const waiterList: WaiterReport[] = Array.isArray(waiterRes) ? waiterRes : (waiterRes.waiters || []);
      setSummary(summaryData);
      setDishes(dishList.slice(0, 5));
      setWaiters(waiterList);
    } catch (e) {
      console.error("[Relatorios] Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    console.log("[Relatorios] Manual refresh");
    setRefreshing(true);
    fetchData();
  };

  const PERIODS: { key: Period; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
  ];

  const maxDishQty = Math.max(...dishes.map((d) => d.quantity_sold), 1);
  const totalRevenue = formatCurrency(summary.total_revenue ?? 0);
  const orderCount = String(summary.order_count ?? 0);
  const avgTicket = formatCurrency(summary.avg_ticket ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
          Relatórios
        </Text>

        {/* Period tabs */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {PERIODS.map((p) => (
            <AnimatedPressable
              key={p.key}
              onPress={() => {
                console.log("[Relatorios] Period changed:", p.key);
                setPeriod(p.key);
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: period === p.key ? COLORS.primary : COLORS.surfaceSecondary,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 13,
                  color: period === p.key ? "#fff" : COLORS.textSecondary,
                }}
              >
                {p.label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Summary */}
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
            Resumo Financeiro
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Faturamento", value: totalRevenue, color: COLORS.success },
              { label: "Comandas", value: orderCount, color: COLORS.primary },
              { label: "Ticket Médio", value: avgTicket, color: "#3B82F6" },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  gap: 6,
                }}
              >
                {loading ? (
                  <>
                    <SkeletonLine width="80%" height={18} />
                    <SkeletonLine width="60%" height={12} />
                  </>
                ) : (
                  <>
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: stat.color }}>
                      {stat.value}
                    </Text>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
                      {stat.label}
                    </Text>
                  </>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Top dishes */}
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
            Pratos Mais Vendidos
          </Text>
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              gap: 14,
            }}
          >
            {loading ? (
              [0, 1, 2].map((i) => (
                <View key={i} style={{ gap: 6 }}>
                  <SkeletonLine width="50%" height={13} />
                  <SkeletonLine width="100%" height={10} borderRadius={5} />
                </View>
              ))
            ) : dishes.length === 0 ? (
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                Sem dados para o período
              </Text>
            ) : (
              dishes.map((dish) => {
                const barWidth = (dish.quantity_sold / maxDishQty) * 100;
                const revenue = formatCurrency(dish.revenue);
                const barWidthStr = `${barWidth}%`;
                return (
                  <View key={dish.dish_id} style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text, flex: 1 }}
                      >
                        {dish.dish_name}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginLeft: 8 }}>
                        {dish.quantity_sold}x
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 }}>
                        ·
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 }}>
                        {revenue}
                      </Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: COLORS.surfaceSecondary, borderRadius: 4 }}>
                      <View
                        style={{
                          height: 8,
                          width: barWidthStr,
                          backgroundColor: COLORS.primary,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Waiters performance */}
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
            Desempenho dos Garçons
          </Text>
          <View style={{ gap: 8 }}>
            {loading ? (
              [0, 1, 2].map((i) => (
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
                  <SkeletonLine width="70%" height={12} />
                </View>
              ))
            ) : waiters.length === 0 ? (
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
                  Sem dados para o período
                </Text>
              </View>
            ) : (
              waiters.map((waiter) => {
                const revenue = formatCurrency(waiter.revenue);
                const avgT = formatCurrency(waiter.avg_ticket);
                return (
                  <View
                    key={waiter.waiter_id}
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
                        {waiter.waiter_name}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                        {waiter.order_count} comandas
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                        ticket médio {avgT}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.primary }}>
                      {revenue}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
