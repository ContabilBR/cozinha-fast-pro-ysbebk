import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { Mesa } from "@/types";
import { apiGet } from "@/utils/api";
import { getMesaStatusLabel, getMesaStatusColor, isAdmin } from "@/utils/helpers";
import { Users } from "lucide-react-native";

export default function MesaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const COLORS = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;
  const canAdmin = isAdmin(role);

  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

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

  const handleOpenComanda = () => {
    if (!mesa) return;
    console.log("[Mesa] Abrir Comanda (cardápio) pressionado para mesa:", mesa.numero, "id:", mesa.id);
    router.push({
      pathname: "/comanda/nova",
      params: { mesa_id: mesa.id, mesa_numero: String(mesa.numero) },
    });
  };

  const statusColor = getMesaStatusColor(mesa?.status ?? "livre");
  const statusLabel = getMesaStatusLabel(mesa?.status ?? "livre");
  const mesaTitle = mesa ? `Mesa ${mesa.numero}` : "Detalhes da Mesa";
  const mesaNumero = mesa?.numero;
  const mesaCapacidade = mesa?.capacidade;
  const mesaStatus = mesa?.status ?? "livre";
  const comandaId = (mesa as any)?.comanda_id;
  const garcomName = (mesa as any)?.garcom?.name;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top", "left", "right"]}>
      {/* Nav bar */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.surface,
      }}>
        <Pressable
          onPress={() => { console.log("[Mesa] Botão voltar pressionado"); router.back(); }}
          style={{ flexDirection: "row", alignItems: "center", paddingRight: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
          <Text style={{ fontFamily: "Outfit_600SemiBold", color: COLORS.primary, fontSize: 15, marginLeft: 2 }}>Voltar</Text>
        </Pressable>
        <Text style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Outfit_700Bold",
          fontSize: 17,
          color: COLORS.text,
          height: 56,
          lineHeight: 56,
        }}>
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
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>{error}</Text>
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
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 28, color: statusColor }}>{mesaNumero}</Text>
              </View>
              <View style={{ backgroundColor: statusColor + "20", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: statusColor }}>{statusLabel}</Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Users size={16} color={COLORS.textSecondary} />
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Capacidade:</Text>
                <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{mesaCapacidade} pessoas</Text>
              </View>
              {garcomName ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>Garçom:</Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>{garcomName}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {comandaId ? (
            <AnimatedPressable
              onPress={() => { console.log("[Mesa] Ver comanda pressionado:", comandaId); router.push(`/comanda/${comandaId}`); }}
              style={{ backgroundColor: COLORS.primaryMuted, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.primary + "30" }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.primary }}>Ver comanda ativa</Text>
            </AnimatedPressable>
          ) : null}

          {(mesaStatus === "livre" || (mesaStatus as string) === "disponivel") && (role === "garcom" || canAdmin) ? (
            <AnimatedPressable
              onPress={() => { console.log("[Mesa] Abrir Comanda pressionado"); handleOpenComanda(); }}
              style={{ backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>Abrir Comanda</Text>
            </AnimatedPressable>
          ) : null}

          {mesaStatus === "ocupada" && comandaId ? (
            <AnimatedPressable
              onPress={() => { console.log("[Mesa] Fazer pedido pressionado, comanda:", comandaId); router.push({ pathname: "/pedido/novo", params: { comanda_id: comandaId, mesa_id: id } }); }}
              style={{ backgroundColor: COLORS.surface, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border }}
            >
              <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: COLORS.text }}>Fazer pedido</Text>
            </AnimatedPressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
