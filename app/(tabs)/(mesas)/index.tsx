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
import { apiGet } from "@/utils/api";
import { Users } from "lucide-react-native";

interface ApiTable {
  id: string;
  number: number;
  capacity: number;
  status: string;
}

function getTableStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    livre: "Livre",
    free: "Livre",
    ocupada: "Ocupada",
    occupied: "Ocupada",
    reservada: "Reservada",
    reserved: "Reservada",
  };
  return labels[status] || String(status);
}

function getTableStatusColor(status: string): string {
  const map: Record<string, string> = {
    livre: "#22C55E",
    free: "#22C55E",
    ocupada: "#E8521A",
    occupied: "#E8521A",
    reservada: "#F59E0B",
    reserved: "#F59E0B",
  };
  return map[status] || "#94A3B8";
}

function TableCard({ table, onPress, index }: { table: ApiTable; onPress: () => void; index: number }) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const statusColor = getTableStatusColor(table.status);
  const statusLabel = getTableStatusLabel(table.status);
  const isOccupied = table.status !== "livre" && table.status !== "free";

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flex: 1, margin: 6 }}>
      <AnimatedPressable
        onPress={onPress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 2,
          borderColor: isOccupied ? statusColor + "50" : COLORS.border,
          minHeight: 140,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: statusColor + "18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: statusColor }}>
              {table.number}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: statusColor + "20",
              borderRadius: 20,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 10, color: statusColor }}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={{ gap: 4, marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Users size={13} color={COLORS.textSecondary} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {table.capacity} lugares
            </Text>
          </View>
        </View>

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
  const role = user?.role;
  const canAdmin = role === "admin" || role === "administrador" || role === "gerente";

  const [tables, setTables] = useState<ApiTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchTables = useCallback(async () => {
    console.log("[Mesas] Fetching tables from /api/tables");
    try {
      const res = await apiGet<any>("/api/tables");
      const list: ApiTable[] = Array.isArray(res) ? res : (res.tables || []);
      console.log("[Mesas] Loaded", list.length, "tables");
      setTables(list);
      setError("");
    } catch (e: any) {
      console.error("[Mesas] Error fetching tables:", e instanceof Error ? e.message : String(e));
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

  const handleTablePress = (table: ApiTable) => {
    console.log("[Mesas] Table pressed:", table.number, "status:", table.status);
    router.push(`/order/new?table_id=${table.id}`);
  };

  const livreCount = tables.filter((t) => t.status === "livre" || t.status === "free").length;
  const ocupadaCount = tables.filter((t) => t.status !== "livre" && t.status !== "free").length;

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
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 26, color: COLORS.text, letterSpacing: -0.3 }}>
            Mesas
          </Text>
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
            {ocupadaCount} ocupadas · {livreCount} livres
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingVertical: 10, gap: 12, flexWrap: "wrap" }}>
        {(["livre", "ocupada", "reservada"] as string[]).map((s) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getTableStatusColor(s) }} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
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
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={tables}
          renderItem={({ item, index }) => (
            <TableCard table={item} onPress={() => handleTablePress(item)} index={index} />
          )}
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
                Nenhuma mesa cadastrada
              </Text>
              <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
                As mesas do restaurante aparecerão aqui
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
