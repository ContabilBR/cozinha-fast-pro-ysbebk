import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Mesa } from "@/types";
import { apiGet, apiPost } from "@/utils/api";
import { getMesaStatusLabel, getMesaStatusColor, isAdmin } from "@/utils/helpers";
import { Users, Pencil } from "lucide-react-native";

export default function MesaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const COLORS = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const canAdmin = isAdmin(role);

  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [openingComanda, setOpeningComanda] = useState(false);

  const fetchMesa = useCallback(async () => {
    console.log("[Mesa] Fetching mesa:", id);
    try {
      const res = await apiGet<any>(`/api/mesas/${id}`);
      const m: Mesa = res.mesa || res;
      setMesa(m);
      setError("");
    } catch (e: any) {
      console.error("[Mesa] Error:", e);
      setError("Não foi possível carregar a mesa.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchMesa(); }, [fetchMesa]);

  const handleRefresh = () => {
    console.log("[Mesa] Manual refresh");
    setRefreshing(true);
    fetchMesa();
  };

  const handleOpenComanda = async () => {
    if (!mesa) return;
    console.log("[Mesa] Open comanda pressed for mesa:", mesa.numero);
    setOpeningComanda(true);
    try {
      const res = await apiPost<any>("/api/comandas", { mesa_id: mesa.id });
      const comanda = res.comanda || res;
      console.log("[Mesa] Comanda opened:", comanda.id);
      router.replace(`/comanda/${comanda.id}`);
    } catch (e: any) {
      console.error("[Mesa] Open comanda error:", e);
    } finally {
      setOpeningComanda(false);
    }
  };

  const statusColor = getMesaStatusColor(mesa?.status ?? "livre");
  const statusLabel = getMesaStatusLabel(mesa?.status ?? "livre");

  return (
    <>
      <Stack.Screen
        options={{
          title: mesa ? `Mesa ${mesa.numero}` : "Mesa",
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
          headerRight: canAdmin
            ? () => (
                <AnimatedPressable
                  onPress={() => {
                    console.log("[Mesa] Edit pressed:", id);
                    router.push(`/mesa/editar/${id}`);
                  }}
                  style={{ padding: 8 }}
                >
                  <Pencil size={20} color={COLORS.primary} />
                </AnimatedPressable>
              )
            : undefined,
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            {[0, 1].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
              Erro ao carregar mesa
            </Text>
            <AnimatedPressable
              onPress={fetchMesa}
              style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
                Tentar novamente
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
            }
          >
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 16,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    backgroundColor: statusColor + "18",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 28, color: statusColor }}>
                    {mesa?.numero}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: statusColor + "20",
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: statusColor }}>
                    {statusLabel}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Users size={16} color={COLORS.textSecondary} />
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                    Capacidade:
                  </Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                    {mesa?.capacidade} pessoas
                  </Text>
                </View>
                {mesa?.garcom && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                      Garçom:
                    </Text>
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
                      {mesa.garcom.name}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {mesa?.comanda_id && (
              <AnimatedPressable
                onPress={() => {
                  console.log("[Mesa] View comanda pressed:", mesa.comanda_id);
                  router.push(`/comanda/${mesa.comanda_id}`);
                }}
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 14,
                  height: 52,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLORS.primary + "30",
                }}
              >
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>
                  Ver comanda ativa
                </Text>
              </AnimatedPressable>
            )}

            {mesa?.status === "livre" && (role === "garcom" || canAdmin) && (
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
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}
