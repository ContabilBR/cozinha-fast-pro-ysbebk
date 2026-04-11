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
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableStatus } from "@/types";
import { apiGet } from "@/utils/api";
import { getTableStatusLabel, formatCurrency, formatRelativeTime } from "@/utils/helpers";
import { RefreshCw, Users, MapPin, Plus } from "lucide-react-native";

const STATUS_COLORS: Record<TableStatus, string> = {
  livre: "#22C55E",
  ocupada: "#E8521A",
  reservada: "#F59E0B",
  fechando: "#8B5CF6",
};

function TableCard({ table, onPress, index }: { table: Table; onPress: () => void; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, []);

  const statusColor = STATUS_COLORS[table.status] || COLORS.textSecondary;
  const isOccupied = table.status === "ocupada" || table.status === "fechando";
  const locationLabel = table.location || "Salão";

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flex: 1, margin: 6 }}>
      <AnimatedPressable
        onPress={onPress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 2,
          borderColor: isOccupied ? statusColor + "40" : COLORS.border,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          minHeight: 140,
          justifyContent: "space-between",
        }}
      >
        {/* Top row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: statusColor + "18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: statusColor }}>
              {table.number}
            </Text>
          </View>
          <StatusBadge status={table.status} type="table" size="sm" />
        </View>

        {/* Middle info */}
        <View style={{ gap: 4, marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Users size={13} color={COLORS.textSecondary} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {table.capacity} lugares
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MapPin size={13} color={COLORS.textSecondary} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {locationLabel}
            </Text>
          </View>
        </View>

        {/* Status indicator dot */}
        <View
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: statusColor,
          }}
        />
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function MesasScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const role = (user as any)?.role;

  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchTables = useCallback(async () => {
    console.log("[Mesas] Fetching tables");
    try {
      const data = await apiGet<Table[]>("/api/tables");
      setTables(data);
      setError("");
    } catch (e: any) {
      console.error("[Mesas] Error fetching tables:", e);
      setError("Não foi possível carregar as mesas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(() => {
      console.log("[Mesas] Auto-refresh");
      fetchTables();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  const handleRefresh = () => {
    console.log("[Mesas] Manual refresh");
    setRefreshing(true);
    fetchTables();
  };

  const handleTablePress = (table: Table) => {
    console.log("[Mesas] Table pressed:", table.number, "status:", table.status);
    if (table.status === "ocupada" || table.status === "fechando") {
      if (table.current_order_id) {
        router.push(`/order/${table.current_order_id}`);
      }
    } else if (table.status === "livre" && (role === "garcom" || role === "administrador")) {
      router.push({ pathname: "/order/new", params: { table_id: table.id, table_number: table.number } });
    }
  };

  const renderItem = ({ item, index }: { item: Table; index: number }) => (
    <TableCard table={item} onPress={() => handleTablePress(item)} index={index} />
  );

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
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
            Mesas
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
            {tables.length} mesas no total
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

      {/* Status legend */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 20,
          paddingVertical: 12,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {(["livre", "ocupada", "reservada", "fechando"] as TableStatus[]).map((s) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLORS[s] }} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {getTableStatusLabel(s)}
            </Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
            Erro ao carregar mesas
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={fetchTables}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 12,
              marginTop: 8,
            }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={tables}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 6, paddingBottom: 120 }}
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
                <Users size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
                Nenhuma mesa encontrada
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                As mesas do restaurante aparecerão aqui
              </Text>
            </View>
          }
        />
      )}

      {/* FAB for garcom/admin */}
      {(role === "garcom" || role === "administrador") && (
        <AnimatedPressable
          onPress={() => {
            console.log("[Mesas] FAB pressed - new order");
            router.push("/order/new");
          }}
          style={{
            position: "absolute",
            bottom: insets.bottom + 90,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(232, 82, 26, 0.4)",
          }}
        >
          <Plus size={24} color="#fff" />
        </AnimatedPressable>
      )}
    </View>
  );
}
