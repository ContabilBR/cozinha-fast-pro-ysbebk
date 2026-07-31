import React, { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/utils/api";
import { formatCurrency } from "@/utils/helpers";

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  pendente: { label: "Pendente", bg: "#FEF3C7", text: "#92400E" },
  processando: { label: "Processando", bg: "#DBEAFE", text: "#1E40AF" },
  autorizada: { label: "Autorizada", bg: "#D1FAE5", text: "#065F46" },
  rejeitada: { label: "Rejeitada", bg: "#FEE2E2", text: "#991B1B" },
  cancelada: { label: "Cancelada", bg: "#F3F4F6", text: "#6B7280" },
  erro: { label: "Erro", bg: "#FEE2E2", text: "#991B1B" },
};

export default function FiscalScreen() {
  const COLORS = useColors();
  const insets = useSafeAreaInsets();
  const [notas, setNotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetch = useCallback(async () => {
    console.log("[FiscalScreen] Fetching notas fiscais from /api/fiscal/notas");
    try {
      const res = await apiGet<any>("/api/fiscal/notas");
      console.log("[FiscalScreen] Notas fiscais received:", res.notas?.length ?? 0, "items");
      setNotas(res.notas || []);
    } catch (e) {
      console.log("[FiscalScreen] Error fetching notas fiscais:", e);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); fetch(); }, [fetch]));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 10 }}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
        <View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.text }}>Notas Fiscais</Text>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>{notas.length} nota{notas.length !== 1 ? "s" : ""} emitida{notas.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>
      {loading ? <View style={{ padding: 16 }}><ActivityIndicator size="large" color={COLORS.primary} /></View> : (
        <FlatList data={notas} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { console.log("[FiscalScreen] Pull-to-refresh triggered"); setRefreshing(true); fetch(); }} tintColor={COLORS.primary} />}
          renderItem={({ item }) => {
            const s = STATUS_CFG[item.status] || STATUS_CFG.pendente;
            return (
              <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: COLORS.surfaceSecondary }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>#{(item.referenciaFocus || item.referencia_focus || "").slice(-8)}</Text>
                  <View style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 }}><Text style={{ fontSize: 11, fontWeight: "600", color: s.text }}>{s.label}</Text></View>
                </View>
                {item.chaveAcesso && <Text style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 6 }} numberOfLines={1}>Chave: {item.chaveAcesso || item.chave_acesso}</Text>}
                {item.numeroNota && <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>Nota nº {item.numeroNota || item.numero_nota} série {item.serie}</Text>}
                <Text style={{ fontSize: 11, color: COLORS.textTertiary, marginTop: 4 }}>{new Date(item.createdAt || item.created_at).toLocaleString("pt-BR")}</Text>
                {item.mensagemSefaz && <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>{item.mensagemSefaz || item.mensagem_sefaz}</Text>}
              </View>
            );
          }}
          ListEmptyComponent={<View style={{ alignItems: "center", paddingTop: 60 }}><Ionicons name="document-text-outline" size={48} color={COLORS.textTertiary} /><Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 12 }}>Nenhuma nota fiscal emitida</Text></View>}
        />
      )}
    </View>
  );
}
