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
import { Users } from "lucide-react-native";

interface ApiMesa {
  id: string;
  numero: number;
  capacidade: number;
  status: string;
  comanda_id?: string;
}

function getMesaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    disponivel: "Disponível",
    livre: "Disponível",
    free: "Disponível",
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

function TableCard({
  mesa,
  onPress,
  index,
  role,
  onAbrirChamado,
  onVerComanda,
}: {
  mesa: ApiMesa;
  onPress: () => void;
  index: number;
  role?: string;
  onAbrirChamado?: () => void;
  onVerComanda?: () => void;
}) {
  const COLORS = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const statusColor = getMesaStatusColor(mesa.status);
  const statusLabel = getMesaStatusLabel(mesa.status);
  const livre = isDisponivel(mesa.status);
  const isGarcom = role === "garcom";

  const showAbrirChamado = isGarcom && livre;
  const showVerComanda = isGarcom && !livre && !!mesa.comanda_id;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], flex: 1, margin: 6 }}>
      <AnimatedPressable
        onPress={onPress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 2,
          borderColor: livre ? COLORS.border : statusColor + "50",
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
              {mesa.numero}
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
              {mesa.capacidade} lugares
            </Text>
          </View>
        </View>

        {showAbrirChamado && (
          <AnimatedPressable
            onPress={(e) => {
              console.log("[Mesas] Abrir Chamado pressionado para mesa:", mesa.numero);
              if (onAbrirChamado) onAbrirChamado();
            }}
            style={{
              marginTop: 10,
              backgroundColor: COLORS.primary,
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: "#fff" }}>
              Abrir Chamado
            </Text>
          </AnimatedPressable>
        )}

        {showVerComanda && (
          <AnimatedPressable
            onPress={(e) => {
              console.log("[Mesas] Ver Comanda pressionado para mesa:", mesa.numero, "comanda_id:", mesa.comanda_id);
              if (onVerComanda) onVerComanda();
            }}
            style={{
              marginTop: 10,
              backgroundColor: statusColor + "18",
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: "center",
              borderWidth: 1,
              borderColor: statusColor + "40",
            }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: statusColor }}>
              Ver Comanda
            </Text>
          </AnimatedPressable>
        )}

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

  const handleAbrirChamado = (mesa: ApiMesa) => {
    console.log("[Mesas] Abrir Chamado para mesa:", mesa.numero, "id:", mesa.id);
    router.push(`/comanda/nova?mesa_id=${mesa.id}&mesa_numero=${mesa.numero}`);
  };

  const handleVerComanda = (mesa: ApiMesa) => {
    console.log("[Mesas] Ver Comanda para mesa:", mesa.numero, "comanda_id:", mesa.comanda_id);
    router.push(`/comanda/${mesa.comanda_id}`);
  };

  const livreCount = mesas.filter((m) => isDisponivel(m.status)).length;
  const ocupadaCount = mesas.filter((m) => !isDisponivel(m.status)).length;

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
            {ocupadaCount} ocupadas · {livreCount} disponíveis
          </Text>
        </View>
      </View>

      {/* Legenda */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingVertical: 10, gap: 12, flexWrap: "wrap" }}>
        {(["disponivel", "ocupada", "reservada"] as string[]).map((s) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getMesaStatusColor(s) }} />
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary }}>
              {getMesaStatusLabel(s)}
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
            onPress={fetchMesas}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
              Tentar novamente
            </Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={mesas}
          renderItem={({ item, index }) => (
            <TableCard
              mesa={item}
              onPress={() => handleMesaPress(item)}
              index={index}
              role={role}
              onAbrirChamado={() => handleAbrirChamado(item)}
              onVerComanda={() => handleVerComanda(item)}
            />
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
