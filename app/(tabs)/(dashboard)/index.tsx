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
import { Pedido, Mesa } from "@/types";
import { apiGet } from "@/utils/api";
import { formatCurrency, formatRelativeTime, getMesaStatusColor, getPedidoStatusLabel, getPedidoStatusColor } from "@/utils/helpers";
import { TrendingUp, ShoppingBag, Grid3x3, Flame, RefreshCw, ChevronRight } from "lucide-react-native";

interface ResumoData {
  total_mesas?: number;
  ocupacao_atual?: number;
  comandas_abertas?: number;
  faturamento_dia?: number;
}

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
        </>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [resumo, setResumo] = useState<ResumoData>({});
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [recentPedidos, setRecentPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    console.log("[Dashboard] Fetching dashboard data");
    try {
      const [resumoRes, mesasRes, pedidosRes] = await Promise.all([
        apiGet<any>("/api/relatorios/resumo").catch(() => ({})),
        apiGet<any>("/api/mesas").catch(() => []),
        apiGet<any>("/api/pedidos").catch(() => []),
      ]);
      const resumoData: ResumoData = resumoRes?.resumo || resumoRes || {};
      const mesaList: Mesa[] = Array.isArray(mesasRes) ? mesasRes : (mesasRes.mesas || []);
      const pedidoList: Pedido[] = Array.isArray(pedidosRes) ? pedidosRes : (pedidosRes.pedidos || []);
      setResumo(resumoData);
      setMesas(mesaList);
      const sorted = pedidoList.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
      setRecentPedidos(sorted.slice(0, 5));
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

  const totalMesas = resumo.total_mesas ?? mesas.length;
  const ocupacaoAtual = resumo.ocupacao_atual ?? mesas.filter((m) => m.status !== "livre" && m.status !== "finalizada").length;
  const comandasAbertas = resumo.comandas_abertas ?? 0;
  const faturamentoDia = formatCurrency(resumo.faturamento_dia ?? 0);
  const emPreparoCount = recentPedidos.filter((p) => p.status === "em_preparacao").length;
  const prontoCount = recentPedidos.filter((p) => p.status === "pronto").length;

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
              title="Faturamento Hoje"
              value={faturamentoDia}
              color={COLORS.success}
              icon={<TrendingUp size={20} color={COLORS.success} />}
              loading={loading}
            />
            <StatCard
              title="Comandas Abertas"
              value={String(comandasAbertas)}
              color={COLORS.primary}
              icon={<ShoppingBag size={20} color={COLORS.primary} />}
              loading={loading}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              title="Mesas Ocupadas"
              value={`${ocupacaoAtual}/${totalMesas}`}
              color="#3B82F6"
              icon={<Grid3x3 size={20} color="#3B82F6" />}
              loading={loading}
            />
            <StatCard
              title="Em Preparo"
              value={String(emPreparoCount)}
              color={COLORS.warning}
              icon={<Flame size={20} color={COLORS.warning} />}
              loading={loading}
            />
          </View>
        </Animated.View>

        {/* Quick stats */}
        {prontoCount > 0 && (
          <View
            style={{
              backgroundColor: COLORS.success + "15",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: COLORS.success + "30",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success }} />
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.success }}>
              {prontoCount} {prontoCount === 1 ? "pedido pronto" : "pedidos prontos"} aguardando entrega
            </Text>
          </View>
        )}

        {/* Mesas mini-grid */}
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text, marginBottom: 12 }}>
            Mesas
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {loading
              ? [0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.surfaceSecondary }} />
                ))
              : mesas.map((mesa) => {
                  const color = getMesaStatusColor(mesa.status);
                  return (
                    <AnimatedPressable
                      key={mesa.id}
                      onPress={() => {
                        console.log("[Dashboard] Mesa mini pressed:", mesa.numero);
                        if (mesa.comanda_id) router.push(`/comanda/${mesa.comanda_id}`);
                        else router.push(`/mesa/${mesa.id}`);
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
                        {mesa.numero}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
          </View>
        </View>

        {/* Recent pedidos */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text }}>
              Últimos Pedidos
            </Text>
            <AnimatedPressable
              onPress={() => {
                console.log("[Dashboard] View all pedidos pressed");
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
          ) : recentPedidos.length === 0 ? (
            <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                Nenhum pedido recente
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {recentPedidos.map((pedido) => {
                const mesaNum = pedido.mesa?.numero ?? "?";
                const garcom = pedido.garcom?.name ?? "—";
                const time = formatRelativeTime(pedido.sent_at);
                const statusColor = getPedidoStatusColor(pedido.status);
                const statusLabel = getPedidoStatusLabel(pedido.status);
                return (
                  <AnimatedPressable
                    key={pedido.id}
                    onPress={() => {
                      console.log("[Dashboard] Recent pedido pressed:", pedido.id);
                      router.push(`/pedido/${pedido.id}`);
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
                        Mesa {mesaNum}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                        {garcom}
                      </Text>
                      <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
                        {time}
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
