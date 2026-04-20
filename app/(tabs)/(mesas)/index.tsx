import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet } from "@/utils/api";
import { Users, ChevronRight } from "lucide-react-native";

interface ApiMesa {
  id: string;
  numero: number;
  capacidade: number;
  status: string;
  comanda_id?: string;
}

function getMesaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    disponivel: "Livre",
    livre: "Livre",
    free: "Livre",
    ocupada: "Ocupada",
    occupied: "Ocupada",
    reservada: "Reservada",
    reserved: "Reservada",
  };
  return labels[status] || String(status);
}

function getMesaStatusColor(status: string): string {
  const map: Record<string, string> = {
    disponivel: "#22C55E",
    livre: "#22C55E",
    free: "#22C55E",
    ocupada: "#E8521A",
    occupied: "#E8521A",
    reservada: "#F59E0B",
    reserved: "#F59E0B",
  };
  return map[status] || "#94A3B8";
}

function isDisponivel(status: string): boolean {
  return status === "disponivel" || status === "livre" || status === "free";
}

function MesaListItem({
  mesa,
  onPress,
  index,
}: {
  mesa: ApiMesa;
  onPress: () => void;
  index: number;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay: index * 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  const statusColor = getMesaStatusColor(mesa.status);
  const statusLabel = getMesaStatusLabel(mesa.status);
  const livre = isDisponivel(mesa.status);
  const mesaLabel = `Mesa ${mesa.numero}`;
  const capacidadeLabel = `Capacidade: ${mesa.capacidade} pessoas`;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={() => {
          console.log("[Mesas] Mesa row pressed:", mesa.numero, "status:", mesa.status);
          onPress();
        }}
        style={{
          backgroundColor: COLORS.surface,
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: livre ? COLORS.border : statusColor + "40",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        {/* Status dot + Mesa number */}
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: statusColor + "18",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 22,
              color: statusColor,
            }}
          >
            {mesa.numero}
          </Text>
        </View>

        {/* Center info */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 17,
              color: COLORS.text,
              letterSpacing: -0.2,
            }}
          >
            {mesaLabel}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Users size={12} color={COLORS.textSecondary} />
            <Text
              style={{
                fontFamily: "Outfit_400Regular",
                fontSize: 13,
                color: COLORS.textSecondary,
              }}
            >
              {capacidadeLabel}
            </Text>
          </View>
        </View>

        {/* Status badge */}
        <View
          style={{
            backgroundColor: statusColor + "20",
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 4,
            marginRight: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
              color: statusColor,
            }}
          >
            {statusLabel}
          </Text>
        </View>

        {/* Chevron */}
        <ChevronRight size={18} color={COLORS.textSecondary} />
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function MesasScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const role = user?.role as string | undefined;
  const canAdmin = role === "admin" || role === "administrador" || role === "gerente";

  const [mesas, setMesas] = useState<ApiMesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchMesas = useCallback(async () => {
    console.log("[Mesas] Fetching mesas from /api/mesas");
    try {
      const res = await apiGet<any>("/api/mesas");
      const list: ApiMesa[] = Array.isArray(res) ? res : (res.mesas || []);
      console.log("[Mesas] Loaded", list.length, "mesas");
      setMesas(list);
      setError("");
    } catch (e: any) {
      console.error("[Mesas] Error fetching mesas:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar as mesas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchMesas();
    const interval = setInterval(() => {
      console.log("[Mesas] Auto-refresh (30s)");
      fetchMesas();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMesas]));

  const handleRefresh = () => {
    console.log("[Mesas] Manual refresh");
    setRefreshing(true);
    fetchMesas();
  };

  const handleMesaPress = (mesa: ApiMesa) => {
    console.log("[Mesas] Mesa pressed:", mesa.numero, "status:", mesa.status, "comanda_id:", mesa.comanda_id);
    if (!isDisponivel(mesa.status) && mesa.comanda_id) {
      router.push(`/comanda/${mesa.comanda_id}`);
    } else if (isDisponivel(mesa.status) && (role === "garcom" || canAdmin)) {
      router.push(`/comanda/nova?mesa_id=${mesa.id}&mesa_numero=${mesa.numero}`);
    } else {
      router.push(`/mesa/${mesa.id}`);
    }
  };

  const livreCount = mesas.filter((m) => isDisponivel(m.status)).length;
  const ocupadaCount = mesas.filter((m) => !isDisponivel(m.status)).length;

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
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 26,
              color: COLORS.text,
              letterSpacing: -0.3,
            }}
          >
            Mesas
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 13,
              color: COLORS.textSecondary,
            }}
          >
            {ocupadaCount} ocupadas · {livreCount} disponíveis
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 20,
          paddingVertical: 10,
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        {(["disponivel", "ocupada", "reservada"] as string[]).map((s) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: getMesaStatusColor(s),
              }}
            />
            <Text
              style={{
                fontFamily: "Outfit_400Regular",
                fontSize: 11,
                color: COLORS.textSecondary,
              }}
            >
              {getMesaStatusLabel(s)}
            </Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            gap: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 17,
              color: COLORS.text,
            }}
          >
            Erro ao carregar mesas
          </Text>
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 14,
              color: COLORS.textSecondary,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
          <AnimatedPressable
            onPress={fetchMesas}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 15,
                color: "#fff",
              }}
            >
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={mesas}
          renderItem={({ item, index }) => (
            <MesaListItem
              mesa={item}
              onPress={() => handleMesaPress(item)}
              index={index}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                padding: 48,
                gap: 12,
              }}
            >
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
              <Text
                style={{
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 17,
                  color: COLORS.text,
                }}
              >
                Nenhuma mesa cadastrada
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 14,
                  color: COLORS.textSecondary,
                  textAlign: "center",
                }}
              >
                As mesas do restaurante aparecerão aqui
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
