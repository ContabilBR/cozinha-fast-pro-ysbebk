import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Mesa } from "@/types";
import { apiGet, apiPost } from "@/utils/api";
import { getMesaStatusLabel, getMesaStatusColor, isAdmin } from "@/utils/helpers";
import { Users, Plus, X } from "lucide-react-native";

function MesaCard({ mesa, onPress, index }: { mesa: Mesa; onPress: () => void; index: number }) {
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
  const isOccupied = mesa.status !== "livre" && mesa.status !== "finalizada";
  const garcomName = mesa.garcom?.name;

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
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
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
          {garcomName ? (
            <Text numberOfLines={1} style={{ fontFamily: "Outfit_400Regular", fontSize: 12, color: COLORS.textSecondary }}>
              {garcomName}
            </Text>
          ) : null}
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
  const role = (user as any)?.role;
  const canAdmin = isAdmin(role);

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [openingComanda, setOpeningComanda] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchMesas = useCallback(async () => {
    console.log("[Mesas] Fetching mesas");
    try {
      const res = await apiGet<any>("/api/mesas");
      const list: Mesa[] = Array.isArray(res) ? res : (res.mesas || []);
      setMesas(list);
      setError("");
    } catch (e: any) {
      console.error("[Mesas] Error fetching mesas:", e);
      setError("Não foi possível carregar as mesas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMesas();
    const interval = setInterval(() => {
      console.log("[Mesas] Auto-refresh");
      fetchMesas();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMesas]);

  const handleRefresh = () => {
    console.log("[Mesas] Manual refresh");
    setRefreshing(true);
    fetchMesas();
  };

  const handleMesaPress = (mesa: Mesa) => {
    console.log("[Mesas] Mesa pressed:", mesa.numero, "status:", mesa.status);
    if (mesa.status === "livre") {
      if (role === "garcom" || canAdmin) {
        setSelectedMesa(mesa);
        setShowModal(true);
      }
    } else if (mesa.comanda_id) {
      router.push(`/comanda/${mesa.comanda_id}`);
    } else {
      router.push(`/mesa/${mesa.id}`);
    }
  };

  const handleOpenComanda = async () => {
    if (!selectedMesa) return;
    console.log("[Mesas] Opening comanda for mesa:", selectedMesa.numero);
    setOpeningComanda(true);
    try {
      const res = await apiPost<any>("/api/comandas", { mesa_id: selectedMesa.id });
      const comanda = res.comanda || res;
      console.log("[Mesas] Comanda opened:", comanda.id);
      setShowModal(false);
      setSelectedMesa(null);
      await fetchMesas();
      router.push(`/comanda/${comanda.id}`);
    } catch (e: any) {
      console.error("[Mesas] Error opening comanda:", e);
    } finally {
      setOpeningComanda(false);
    }
  };

  const livreCount = mesas.filter((m) => m.status === "livre").length;
  const ocupadaCount = mesas.filter((m) => m.status !== "livre" && m.status !== "finalizada").length;

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
        {canAdmin && (
          <AnimatedPressable
            onPress={() => {
              console.log("[Mesas] Add mesa pressed");
              router.push("/mesa/nova");
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: COLORS.primaryMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={20} color={COLORS.primary} />
          </AnimatedPressable>
        )}
      </View>

      {/* Legend */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingVertical: 10, gap: 12, flexWrap: "wrap" }}>
        {(["livre", "ocupada", "aguardando_pedido", "em_preparacao", "pedido_pronto"] as Mesa["status"][]).map((s) => (
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
            <MesaCard mesa={item} onPress={() => handleMesaPress(item)} index={index} />
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

      {/* Open comanda modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 360,
              gap: 16,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
                Abrir Comanda
              </Text>
              <AnimatedPressable
                onPress={() => setShowModal(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceSecondary, alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} color={COLORS.textSecondary} />
              </AnimatedPressable>
            </View>
            <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 15, color: COLORS.textSecondary }}>
              Abrir comanda para a Mesa {selectedMesa?.numero}?
            </Text>
            <AnimatedPressable
              onPress={handleOpenComanda}
              disabled={openingComanda}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 14,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {openingComanda ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                  Abrir comanda
                </Text>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
