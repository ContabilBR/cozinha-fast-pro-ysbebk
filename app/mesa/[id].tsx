import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, SafeAreaView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Mesa } from "@/types";
import { apiGet, apiPost } from "@/utils/api";
import { getMesaStatusLabel, getMesaStatusColor, isAdmin } from "@/utils/helpers";
import { Users } from "lucide-react-native";

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
    console.log("[Mesa] GET /api/mesas/" + id);
    try {
      const res = await apiGet<any>(`/api/mesas/${id}`);
      const m: Mesa = res.mesa || res;
      setMesa(m);
      setError("");
    } catch (e: any) {
      console.error("[Mesa] Erro:", e);
      setError("Não foi possível carregar a mesa.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchMesa(); }, [fetchMesa]);

  const handleRefresh = () => {
    console.log("[Mesa] Refresh manual");
    setRefreshing(true);
    fetchMesa();
  };

  const handleOpenComanda = async () => {
    if (!mesa) return;
    console.log("[Mesa] Abrir comanda pressionado para mesa:", mesa.numero);
    setOpeningComanda(true);
    try {
      console.log("[Mesa] POST /api/comandas");
      const res = await apiPost<any>("/api/comandas", { mesa_id: mesa.id });
      const comanda = res.comanda || res;
      console.log("[Mesa] Comanda aberta:", comanda.id);
      router.replace(`/comanda/${comanda.id}`);
    } catch (e: any) {
      console.error("[Mesa] Erro ao abrir comanda:", e);
    } finally {
      setOpeningComanda(false);
    }
  };

  const statusColor = getMesaStatusColor(mesa?.status ?? "livre");
  const statusLabel = getMesaStatusLabel(mesa?.status ?? "livre");
  const mesaTitle = mesa ? `Mesa ${mesa.numero}` : "Detalhes da Mesa";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Nav bar */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
        backgroundColor: "#fff",
      }}>
        <TouchableOpacity
          onPress={() => { console.log("[Mesa] Botão voltar pressionado"); router.back(); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ flexDirection: "row", alignItems: "center", zIndex: 1 }}
        >
          <Ionicons name="chevron-back" size={26} color="#007AFF" />
          <Text style={{ color: "#007AFF", fontSize: 17, fontWeight: "500" }}>Voltar</Text>
        </TouchableOpacity>
        <Text style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#111" }}>
          {mesaTitle}
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1].map((i) => <CardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>Erro ao carregar mesa</Text>
          <AnimatedPressable
            onPress={fetchMesa}
            style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>Tentar novamente</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />}
        >
          <View style={{ backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: statusColor + "18", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 28, color: statusColor }}>{mesa?.numero}</Text>
              </View>
              <View style={{ backgroundColor: statusColor + "20", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: statusColor }}>{statusLabel}</Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Users size={16} color={COLORS.textSecondary} />
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Capacidade:</Text>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{mesa?.capacidade} pessoas</Text>
              </View>
              {mesa?.garcom && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Garçom:</Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{mesa.garcom.name}</Text>
                </View>
              )}
            </View>
          </View>

          {mesa?.comanda_id && (
            <AnimatedPressable
              onPress={() => { console.log("[Mesa] Ver comanda pressionado:", mesa.comanda_id); router.push(`/comanda/${mesa.comanda_id}`); }}
              style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.primary + "30" }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>Ver comanda ativa</Text>
            </AnimatedPressable>
          )}

          {mesa?.status === "livre" && (role === "garcom" || canAdmin) && (
            <AnimatedPressable
              onPress={() => { console.log("[Mesa] Abrir comanda pressionado"); handleOpenComanda(); }}
              disabled={openingComanda}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
            >
              {openingComanda ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Abrir comanda</Text>
              )}
            </AnimatedPressable>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
