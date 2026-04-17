import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { CardSkeleton } from "@/components/SkeletonLoader";
import { apiGet, apiPut } from "@/utils/api";
import { formatCurrency, formatDate, getPedidoStatusLabel, getPedidoStatusColor, isAdmin } from "@/utils/helpers";
import { Plus, X, CheckCircle, ShoppingBag } from "lucide-react-native";

interface PedidoItem {
  id: string;
  prato_id: string;
  prato?: { id: string; nome: string; preco: number };
  quantidade: number;
  observacao?: string;
  status: string;
  created_at?: string;
}

interface ComandaDetail {
  id: string;
  mesa_id: string;
  mesa?: { id: string; numero: number };
  garcom_id: string;
  garcom?: { id: string; name: string };
  status: string;
  total?: number;
  created_at?: string;
  closed_at?: string;
  pedidos?: PedidoItem[];
}

function PedidoRow({ pedido }: { pedido: PedidoItem }) {
  const COLORS = useColors();
  const statusColor = getPedidoStatusColor(pedido.status);
  const statusLabel = getPedidoStatusLabel(pedido.status);
  const pratoNome = pedido.prato?.nome ?? "Prato";
  const preco = formatCurrency((pedido.prato?.preco ?? 0) * pedido.quantidade);

  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          backgroundColor: COLORS.primaryMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 12, color: COLORS.primary }}>
          {pedido.quantidade}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 14, color: COLORS.text }}>
          {pratoNome}
        </Text>
        {pedido.observacao ? (
          <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 11, color: COLORS.textSecondary, fontStyle: "italic" }}>
            {pedido.observacao}
          </Text>
        ) : null}
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary, marginTop: 2 }}>
          {preco}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: statusColor + "20",
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 11, color: statusColor }}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}

export default function ComandaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const COLORS = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const canAdmin = isAdmin(role);

  const [comanda, setComanda] = useState<ComandaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchComanda = useCallback(async () => {
    console.log("[Comanda] Fetching comanda:", id);
    try {
      const res = await apiGet<any>(`/api/comandas/${id}`);
      const c: ComandaDetail = res.comanda || res;
      setComanda(c);
      setError("");
    } catch (e: any) {
      console.error("[Comanda] Error:", e instanceof Error ? e.message : String(e));
      setError("Não foi possível carregar a comanda.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchComanda(); }, [fetchComanda]);

  const handleRefresh = () => {
    console.log("[Comanda] Manual refresh");
    setRefreshing(true);
    fetchComanda();
  };

  const handleClose = async () => {
    console.log("[Comanda] Fechar comanda pressed:", id);
    setClosing(true);
    try {
      await apiPut(`/api/comandas/${id}/fechar`, {});
      console.log("[Comanda] Comanda fechada com sucesso");
      await fetchComanda();
    } catch (e: any) {
      console.error("[Comanda] Close error:", e);
    } finally {
      setClosing(false);
    }
  };

  const handleCancel = async () => {
    console.log("[Comanda] Cancelar comanda pressed:", id);
    setCancelling(true);
    try {
      await apiPut(`/api/comandas/${id}/cancelar`, {});
      console.log("[Comanda] Comanda cancelada");
      router.back();
    } catch (e: any) {
      console.error("[Comanda] Cancel error:", e);
    } finally {
      setCancelling(false);
    }
  };

  const isAberta = comanda?.status === "aberta";
  const total = formatCurrency(comanda?.total ?? 0);
  const openedAt = formatDate(comanda?.created_at);
  const mesaNum = comanda?.mesa?.numero ?? "?";
  const garcomName = comanda?.garcom?.name ?? "—";

  const statusColorMap: Record<string, string> = {
    aberta: COLORS.success,
    fechada: COLORS.textSecondary,
    cancelada: COLORS.danger,
  };
  const comandaStatusColor = statusColorMap[comanda?.status ?? "aberta"] ?? COLORS.textSecondary;
  const comandaStatusLabel = comanda?.status === "aberta" ? "Aberta" : comanda?.status === "fechada" ? "Fechada" : "Cancelada";

  const pedidos = comanda?.pedidos ?? [];
  const allDone = pedidos.length > 0 && pedidos.every((p) => p.status === "pronto" || p.status === "entregue" || p.status === "cancelado");

  return (
    <>
      <Stack.Screen
        options={{
          title: `Comanda — Mesa ${mesaNum}`,
          headerTintColor: COLORS.primary,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 17, color: COLORS.text }}>
              Erro ao carregar comanda
            </Text>
            <AnimatedPressable
              onPress={fetchComanda}
              style={{ backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#fff" }}>
                Tentar novamente
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} />
            }
          >
            {/* Info card */}
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 20, color: COLORS.text }}>
                  Mesa {mesaNum}
                </Text>
                <View
                  style={{
                    backgroundColor: comandaStatusColor + "20",
                    borderRadius: 20,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 12, color: comandaStatusColor }}>
                    {comandaStatusLabel}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
                    Garçom
                  </Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
                    {garcomName}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
                    Aberta em
                  </Text>
                  <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
                    {openedAt}
                  </Text>
                </View>
                {comanda?.closed_at && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 13, color: COLORS.textSecondary }}>
                      Fechada em
                    </Text>
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.text }}>
                      {formatDate(comanda.closed_at)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.divider, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                  Total
                </Text>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 22, color: COLORS.primary }}>
                  {total}
                </Text>
              </View>
            </View>

            {/* Pedidos */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 18, color: COLORS.text }}>
                  Itens ({pedidos.length})
                </Text>
                {isAberta && (
                  <AnimatedPressable
                    onPress={() => {
                      console.log("[Comanda] Adicionar item pressed, comanda:", id);
                      router.push({ pathname: "/pedido/novo", params: { comanda_id: id, mesa_id: comanda?.mesa_id } });
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: COLORS.primaryMuted,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    }}
                  >
                    <Plus size={14} color={COLORS.primary} />
                    <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 13, color: COLORS.primary }}>
                      Adicionar item
                    </Text>
                  </AnimatedPressable>
                )}
              </View>

              {pedidos.length === 0 ? (
                <View style={{ backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border, gap: 8 }}>
                  <ShoppingBag size={28} color={COLORS.textTertiary} />
                  <Text style={{ fontFamily: "Outfit_400Regular", fontSize: 14, color: COLORS.textSecondary }}>
                    Nenhum item ainda
                  </Text>
                </View>
              ) : (
                pedidos.map((pedido) => (
                  <PedidoRow key={pedido.id} pedido={pedido} />
                ))
              )}
            </View>

            {/* Actions */}
            {isAberta && (
              <View style={{ gap: 10 }}>
                {(allDone || canAdmin) && (
                  <AnimatedPressable
                    onPress={handleClose}
                    disabled={closing}
                    style={{
                      backgroundColor: COLORS.success,
                      borderRadius: 14,
                      height: 52,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    {closing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <CheckCircle size={20} color="#fff" />
                        <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 16, color: "#fff" }}>
                          Fechar comanda
                        </Text>
                      </>
                    )}
                  </AnimatedPressable>
                )}

                {canAdmin && (
                  <AnimatedPressable
                    onPress={handleCancel}
                    disabled={cancelling}
                    style={{
                      backgroundColor: COLORS.danger + "15",
                      borderRadius: 14,
                      height: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderWidth: 1,
                      borderColor: COLORS.danger + "30",
                    }}
                  >
                    {cancelling ? (
                      <ActivityIndicator color={COLORS.danger} />
                    ) : (
                      <>
                        <X size={18} color={COLORS.danger} />
                        <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: COLORS.danger }}>
                          Cancelar comanda
                        </Text>
                      </>
                    )}
                  </AnimatedPressable>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}
