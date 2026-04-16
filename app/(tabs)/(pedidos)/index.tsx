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
import { Pedido } from "@/types";
import { apiGet } from "@/utils/api";
import { formatRelativeTime, getPedidoStatusLabel, getPedidoStatusColor } from "@/utils/helpers";
import { ClipboardList, Clock, ShoppingBag } from "lucide-react-native";

function PedidoCard({ pedido, onPress, index }: { pedido: Pedido; onPress: () => void; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const statusColor = getPedidoStatusColor(pedido.status);
  const statusLabel = getPedidoStatusLabel(pedido.status);
  const mesaNum = pedido.mesa?.numero ?? "?";
  const timeStr = formatRelativeTime(pedido.sent_at);
  const itemCount = pedido.itens?.length ?? 0;

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
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
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
                {mesaNum}
              </Text>
            </View>
            <View>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 15, color: COLORS.text }}>
                Mesa {mesaNum}
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.divider }}>
          <ShoppingBag size={13} color={COLORS.textSecondary} />
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </Text>
          {pedido.observacoes ? (
            <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textTertiary, flex: 1, marginLeft: 8 }}>
              {pedido.observacoes}
            </Text>
          ) : null}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function PedidosScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchPedidos = useCallback(async () => {
    console.log("[Pedidos] Fetching pedidos");
    try {
      const res = await apiGet<any>("/api/pedidos");
      const list: Pedido[] = Array.isArray(res) ? res : (res.pedidos || []);
      const sorted = list.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
      setPedidos(sorted);
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
    fetchPedidos();
    const interval = setInterval(() => {
      console.log("[Pedidos] Auto-refresh");
      fetchPedidos();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPedidos]);

  const handleRefresh = () => {
    console.log("[Pedidos] Manual refresh");
    setRefreshing(true);
    fetchPedidos();
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
          Meus Pedidos
        </Text>
        <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
          {pedidos.length} pedidos
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
          <AnimatedPressable
            onPress={fetchPedidos}
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
          renderItem={({ item, index }) => (
            <PedidoCard
              pedido={item}
              onPress={() => {
                console.log("[Pedidos] Pedido pressed:", item.id);
                router.push(`/pedido/${item.id}`);
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
                Seus pedidos aparecerão aqui
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
